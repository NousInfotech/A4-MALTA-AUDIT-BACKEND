### Poppler Setup (Windows)

1. **Download Poppler (ZIP format)**
   Download the latest `Release-xx.xx.x-0.zip` from:
   [https://github.com/oschwartz10612/poppler-windows/releases](https://github.com/oschwartz10612/poppler-windows/releases)

2. **Extract the ZIP file**
   Extract it directly to:

   ```
   C:\poppler-25.12.0
   ```

3. **Verify the folder structure**
   Make sure this path exists:

   ```
   C:\poppler-25.12.0\Library\bin\
   ```

4. **Open Environment Variables**
   Press **Win + R** → type `sysdm.cpl` → Enter

5. **Edit System PATH**
   Go to **Advanced** → **Environment Variables** → **Path** → **Edit**

6. **Add Poppler to PATH**
   Click **New** and add:

   ```
   C:\poppler-25.12.0\Library\bin
   ```

7. **Save and close all dialogs**
   Click **OK** on all windows

8. **Restart terminals and IDE**
   Close and reopen **PowerShell**, **Git Bash**, **VS Code**

9. **Verify Poppler installation**
   Run:

   ```bash
   pdftoppm -h
   ```

10. **Done**
    Poppler is now installed and ready to use.

---
