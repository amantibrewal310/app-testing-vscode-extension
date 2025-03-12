import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";

let emulatorPanel: vscode.WebviewPanel | undefined;
let screenshotInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("Android Emulator Extension is now active");

  let showEmulatorCommand = vscode.commands.registerCommand(
    "app-testing-vscode-extension.showEmulator",
    () => {
      if (emulatorPanel) {
        emulatorPanel.reveal();
        return;
      }

      emulatorPanel = vscode.window.createWebviewPanel(
        "androidEmulator",
        "Android Emulator",
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      emulatorPanel.webview.html = getWebviewContent();

      emulatorPanel.onDidDispose(
        () => {
          emulatorPanel = undefined;
          if (screenshotInterval) {
            clearInterval(screenshotInterval);
            screenshotInterval = undefined;
          }
        },
        null,
        context.subscriptions
      );

      updateEmulatorScreen();
      screenshotInterval = setInterval(updateEmulatorScreen, 2000);
    }
  );

  context.subscriptions.push(showEmulatorCommand);
}

function getWebviewContent() {
  return `<!DOCTYPE html>
	<html>
	<head>
		<style>
			body {
				padding: 0;
				margin: 0;
				background: #1e1e1e;
				display: flex;
				justify-content: center;
				align-items: center;
				height: 100vh;
			}
			#emulator-screen {
				max-width: 100%;
				max-height: 100vh;
				object-fit: contain;
			}
		</style>
	</head>
	<body>
		<img id="emulator-screen" src="" alt="Android Emulator Screen">
		<script>
			const vscode = acquireVsCodeApi();
			window.addEventListener('message', event => {
				const message = event.data;
				if (message.type === 'updateScreen') {
					document.getElementById('emulator-screen').src = message.imageData;
				}
			});
		</script>
	</body>
	</html>`;
}

async function updateEmulatorScreen() {
  if (!emulatorPanel) {
    return;
  }

  try {
    const screenshot = child_process.execSync("adb exec-out screencap -p", {
      encoding: "base64",
      maxBuffer: 25 * 1024 * 1024, // 25MB buffer
    });
    const imageData = `data:image/png;base64,${screenshot}`;

    // Send to webview
    if (emulatorPanel?.visible) {
      emulatorPanel.webview.postMessage({
        type: "updateScreen",
        imageData,
      });
    }
  } catch (error) {
    console.error("Failed to capture emulator screen:", error);

    // Show error only if panel is visible
    if (emulatorPanel?.visible) {
      vscode.window.showErrorMessage(
        "Failed to capture Android emulator screen. Make sure the emulator is running and ADB is available."
      );
    }

    if (screenshotInterval) {
      clearInterval(screenshotInterval);
      screenshotInterval = undefined;
    }
  }
}

export function deactivate() {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = undefined;
  }
}
