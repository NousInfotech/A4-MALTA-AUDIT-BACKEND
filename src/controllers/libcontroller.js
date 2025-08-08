// controllers/globalLibraryController.js
const GlobalFolder = require("../models/GlobalFolder")
const { supabase } = require("../config/supabase")

const BUCKET = "global-documents"

// Basic folder name sanitizer: single-level folder, no slashes
function sanitizeFolderName(name) {
  const cleaned = (name || "").trim()
  // Arbitrary rule: allow letters, numbers, spaces, -, _, and .
  const valid = cleaned.replace(/[^a-zA-Z0-9 _.-]/g, "")
  if (!valid || /[\\/]/.test(valid)) {
    throw new Error("Invalid folder name")
  }
  return valid
}

exports.listFolders = async (req, res, next) => {
  try {
    const folders = await GlobalFolder.find().sort({ createdAt: -1 })
    res.json(folders)
  } catch (err) {
    next(err)
  }
}

exports.createFolder = async (req, res, next) => {
  try {
    const rawName = req.body.name
    const name = sanitizeFolderName(rawName)
    const path = `${name}/`

    const exists = await GlobalFolder.findOne({ name })
    if (exists) return res.status(409).json({ message: "Folder already exists" })

    // Create a placeholder file to ensure folder presence
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(`${path}.keep`, Buffer.from(""), {
        contentType: "text/plain",
        upsert: false,
      })
    if (upErr && upErr.statusCode !== "409") throw upErr // 409 = already exists

    const folder = await GlobalFolder.create({ name, path })
    res.status(201).json(folder)
  } catch (err) {
    next(err)
  }
}

exports.renameFolder = async (req, res, next) => {
  try {
    const { id } = req.params
    const rawNewName = req.body.newName
    const newName = sanitizeFolderName(rawNewName)

    const folder = await GlobalFolder.findById(id)
    if (!folder) return res.status(404).json({ message: "Folder not found" })

    if (newName === folder.name) return res.json(folder)

    const dupe = await GlobalFolder.findOne({ name: newName })
    if (dupe) return res.status(409).json({ message: "Target folder name already exists" })

    const oldPrefix = folder.path // "Old/"
    const newPrefix = `${newName}/`

    // List all items in old folder
    const { data: items, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list(oldPrefix, { limit: 1000 })
    if (listErr) throw listErr

    // Copy each file to new prefix
    for (const item of items || []) {
      const oldPath = `${oldPrefix}${item.name}`
      const newPath = `${newPrefix}${item.name}`
      const { error: copyErr } = await supabase.storage.from(BUCKET).copy(oldPath, newPath)
      if (copyErr) throw copyErr
    }

    // Delete all files from old prefix
    const deletePaths = (items || []).map((i) => `${oldPrefix}${i.name}`)
    if (deletePaths.length) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove(deletePaths)
      if (delErr) throw delErr
    }

    // Ensure placeholder exists in new folder
    await supabase.storage.from(BUCKET).upload(`${newPrefix}.keep`, Buffer.from(""), {
      contentType: "text/plain",
      upsert: true,
    })

    folder.name = newName
    folder.path = newPrefix
    await folder.save()

    res.json(folder)
  } catch (err) {
    next(err)
  }
}

exports.deleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params
    const folder = await GlobalFolder.findById(id)
    if (!folder) return res.status(404).json({ message: "Folder not found" })

    const prefix = folder.path

    // List all items in the folder and delete them
    const { data: items, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 })
    if (listErr) throw listErr

    const deletePaths = (items || []).map((i) => `${prefix}${i.name}`)
    // Also attempt to remove placeholder
    deletePaths.push(`${prefix}.keep`)

    // unique filter
    const uniquePaths = Array.from(new Set(deletePaths))

    // Remove from storage
    const { error: delErr } = await supabase.storage.from(BUCKET).remove(uniquePaths)
    if (delErr) throw delErr

    await GlobalFolder.deleteOne({ _id: folder._id })

    res.json({ message: "Folder and contents deleted" })
  } catch (err) {
    next(err)
  }
}

exports.listFiles = async (req, res, next) => {
  try {
    const { folder } = req.query
    if (!folder) return res.status(400).json({ message: "folder is required" })

    const name = sanitizeFolderName(folder)
    const prefix = `${name}/`

    const { data: items, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } })
    if (error) throw error

    const files = (items || [])
      .filter((i) => i.name !== ".keep") // ignore placeholder
      .map((i) => {
        const fullPath = `${prefix}${i.name}`
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(fullPath)
        return {
          name: i.name,
          size: i.metadata?.size || i.size || 0,
          updatedAt: i.updated_at || new Date().toISOString(),
          publicUrl: pub.publicUrl,
        }
      })

    res.json(files)
  } catch (err) {
    next(err)
  }
}

exports.upload = async (req, res, next) => {
  try {
    const { folder } = req.body
    const file = req.file
    if (!folder) return res.status(400).json({ message: "folder is required" })
    if (!file) return res.status(400).json({ message: "file is required" })

    const name = sanitizeFolderName(folder)
    const path = `${name}/${file.originalname}`

    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    })
    if (error) throw error

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    return res.status(201).json({
      name: file.originalname,
      size: file.size,
      updatedAt: new Date().toISOString(),
      publicUrl: pub.publicUrl,
    })
  } catch (err) {
    next(err)
  }
}

exports.moveFile = async (req, res, next) => {
  try {
    const { fileName, fromFolder, toFolder } = req.body
    if (!fileName || !fromFolder || !toFolder) {
      return res.status(400).json({ message: "fileName, fromFolder, toFolder are required" })
    }
    const from = sanitizeFolderName(fromFolder)
    const to = sanitizeFolderName(toFolder)
    const oldPath = `${from}/${fileName}`
    const newPath = `${to}/${fileName}`

    // Ensure target folder exists (placeholder)
    await supabase.storage.from(BUCKET).upload(`${to}/.keep`, Buffer.from(""), {
      contentType: "text/plain",
      upsert: true,
    })

    const { error: copyErr } = await supabase.storage.from(BUCKET).copy(oldPath, newPath)
    if (copyErr) throw copyErr

    const { error: delErr } = await supabase.storage.from(BUCKET).remove([oldPath])
    if (delErr) throw delErr

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(newPath)
    res.json({ message: "Moved", newPublicUrl: pub.publicUrl })
  } catch (err) {
    next(err)
  }
}

exports.deleteFile = async (req, res, next) => {
  try {
    const { folder, fileName } = req.body
    if (!folder || !fileName) return res.status(400).json({ message: "folder and fileName are required" })

    const name = sanitizeFolderName(folder)
    const path = `${name}/${fileName}`

    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) throw error

    res.json({ message: "File deleted" })
  } catch (err) {
    next(err)
  }
}
