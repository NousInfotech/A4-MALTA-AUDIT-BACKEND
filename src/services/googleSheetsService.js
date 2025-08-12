require("dotenv").config()
const { google } = require("googleapis")
const { URL } = require("url")

const SHEET_NAME = "Sheet1"

function extractSpreadsheetId(sheetUrl) {
  const u = new URL(sheetUrl)
  const match = u.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (match) return match[1]
  const id = u.searchParams.get("id")
  if (id) return id
  throw new Error("No spreadsheet ID found in URL")
}

async function getAuth() {
  try {
    if (!process.env.GOOGLE_CREDENTIALS) {
      throw new Error("GOOGLE_CREDENTIALS environment variable is not set")
    }

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })

    return auth
  } catch (err) {
    console.error("Authentication error:", err.message)
    throw err
  }
}

module.exports.fetch = async function fetchAllRows(sheetUrl) {
  try {
    const auth = await getAuth()
    const sheets = google.sheets({ version: "v4", auth })

    const spreadsheetId = extractSpreadsheetId(sheetUrl)
    const range = `${SHEET_NAME}!A:Z`

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    return res.data.values || []
  } catch (err) {
    console.error("Error in fetchAllRows:", err.message)
    throw err
  }
}
