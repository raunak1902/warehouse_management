# Run the app locally

1. **Open a terminal in this folder**  
   `D:\EDSignage Inventory`

2. **Install dependencies (first time only)**  
   ```bash
   npm install
   ```

3. **Start the dev server**  
   From the project folder run:
   ```bash
   npm run dev
   ```
   On PowerShell, if you need to change directory first, use `;` not `&&`:
   ```powershell
   cd "d:\EDSignage Inventory"; npm run dev
   ```

4. **Open in browser**  
   Use the URL shown in the terminal, e.g.:  
   **http://localhost:5174**

   If you see "Port 5174 is in use":
   - Close any other terminal where you ran `npm run dev`
   - Or run: `npx kill-port 5174` then `npm run dev` again

5. **Login**  
   Use any role (e.g. Admin) to log in and open the dashboard.
