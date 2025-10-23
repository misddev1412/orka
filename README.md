# Orka MCP Server

Orka is a Model Context Protocol (MCP) server that lets IDEs access Orka's task analysis, planning, and orchestration tools directly within your workspace.

## Key Features
- Analyze incoming requirements and summarize actionable work.
- Generate multi-step implementation plans for developers.
- Enhance prompts and suggest new components directly inside the IDE.
- Provide standardized task progress updates through MCP.

## Prerequisites
- Node.js >= 18.18
- npm (bundled with Node.js)
- A valid `OPENAI_API_KEY` (OpenAI-compatible service)

## Installation
```bash
git clone <repo-url>
cd orka
npm install
npm run build
```

### Environment Variables
Create a `.env` file in the project root if you want to override the defaults:
```
OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
# Optional overrides:
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_TOKENS=4000
```
> ⚠️ Never commit your real API keys to version control.

### Running the MCP Server
- `npm run dev`: watch mode (handy during development)
- `npm run build`: compile TypeScript -> `build/mcp/server.js`
- `./bin/orka-mcp`: start the compiled MCP server (invokes the built file)

Make sure you reference the absolute path to `bin/orka-mcp` when registering the server with an IDE or client.

### Installing the Orka CLI Globally
1. Build the project so the compiled CLI is available:
   ```bash
   npm run build
   ```
2. From the repository root install the package globally (this runs `prepare` and links the `orka` binary):
   ```bash
   npm install -g .
   ```
3. Verify the installation and inspect the task state stored in `.orka/state.json` for the project you are working in:
   ```bash
   orka hello
   orka status
   ```

> Re-run `npm install -g .` after pulling new changes to refresh the global binary. Uninstall with `npm uninstall -g orka` if you no longer need the CLI.

## Integrating with IDEs / MCP Clients
In the examples below replace `</path/to/orka>` with the absolute path to your local project directory. You can obtain it with `pwd` after navigating into the repo.

### Cursor
1. Open Cursor → **Settings** → **Features (or Labs)** and enable **Model Context Protocol (MCP)** if this is your first time.
2. Under **MCP Servers**, choose **Add Local Server**.
3. Provide:
   - **Name**: `orka`
   - **Command**: `</path/to/orka>/bin/orka-mcp`
   - **Args**: leave empty (or `["--stdio"]` if Cursor requests it)
4. Save the configuration, open a new chat tab, and confirm Orka appears in the MCP tool list.

> Note: Some Cursor builds support manual configuration via `~/Library/Application Support/Cursor/mcpServers.json`. Add an entry similar to:
> ```json
> {
>   "servers": [
>     {
>       "id": "orka",
>       "name": "Orka MCP",
>       "command": "/Users/<you>/RubymineProjects/orka/bin/orka-mcp",
>       "enabled": true
>     }
>   ]
> }
> ```

### Claude Code
1. Open the **Command Palette** (`Cmd/Ctrl + Shift + P`) → search for `Claude: Configure MCP Servers`.
2. Click **Add Server** → select **Local Command**.
3. Configure:
   - **Name**: `orka`
   - **Command**: `</path/to/orka>/bin/orka-mcp`
   - **Working directory**: `</path/to/orka>` (recommended)
   - **Environment Variables**: add `OPENAI_API_KEY=...` if it is not set globally.
4. Save and restart Claude Code if prompted, then verify Orka appears under **Tools**.

### Codex CLI
1. Ensure Codex CLI is updated to a version that supports MCP.
2. Register the server:
   ```bash
   codex mcp servers add orka \
     --command "</path/to/orka>/bin/orka-mcp" \
     --working-dir "</path/to/orka>"
   ```
3. Confirm the setup with `codex mcp servers list`. Once Orka shows as `ready`, it is available in new sessions.

### Model Context Protocol CLI (Reference Client)
1. Install the reference CLI:
   ```bash
   npm install -g @modelcontextprotocol/cli
   ```
2. Test the connection:
   ```bash
   mcp connect \
     --command "</path/to/orka>/bin/orka-mcp" \
     --name orka
   ```
3. To persist the configuration, create `~/.mcp/clients/default.json`:
   ```json
   {
     "servers": {
       "orka": {
         "command": "/Users/<you>/RubymineProjects/orka/bin/orka-mcp",
         "args": [],
         "env": {
           "OPENAI_API_KEY": "xxxxxxxx"
         }
       }
     }
   }
   ```

## Troubleshooting
- **Server does not appear**: ensure `npm run build` has been run and `bin/orka-mcp` is executable (`chmod +x`).
- **403/401 from OpenAI**: verify `OPENAI_API_KEY` and that the configured `OPENAI_MODEL` is accessible.
- **Connection immediately closes**: most IDEs expect `stdio` transport; Orka already uses it. Confirm the IDE isn't forcing WebSocket mode.

## Updating
```bash
git pull
npm install
npm run build
```
Restart your IDE/client so it reloads the freshly built server.
