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

      // Handle messages from the webview
      emulatorPanel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.type) {
            case 'click':
              try {
                child_process.execSync(
                  `adb shell input tap ${message.x} ${message.y}`,
                  { encoding: 'utf8' }
                );
              } catch (error) {
                console.error('Failed to send tap event:', error);
              }
              break;

            case 'keydown':
              try {
                let keyCommand = '';
                // Map common keys to Android key events
                switch (message.key) {
                  case 'Backspace':
                    keyCommand = 'KEYCODE_DEL';
                    break;
                  case 'Enter':
                    keyCommand = 'KEYCODE_ENTER';
                    break;
                  case 'Tab':
                    keyCommand = 'KEYCODE_TAB';
                    break;
                  case 'ArrowUp':
                    keyCommand = 'KEYCODE_DPAD_UP';
                    break;
                  case 'ArrowDown':
                    keyCommand = 'KEYCODE_DPAD_DOWN';
                    break;
                  case 'ArrowLeft':
                    keyCommand = 'KEYCODE_DPAD_LEFT';
                    break;
                  case 'ArrowRight':
                    keyCommand = 'KEYCODE_DPAD_RIGHT';
                    break;
                  case 'Escape':
                    keyCommand = 'KEYCODE_BACK';
                    break;
                  case 'Home':
                    keyCommand = 'KEYCODE_HOME';
                    break;
                  default:
                    if (message.key.length === 1) {
                      // For regular text input
                      child_process.execSync(
                        `adb shell input text "${message.key}"`,
                        { encoding: 'utf8' }
                      );
                      return;
                    }
                }

                if (keyCommand) {
                  child_process.execSync(
                    `adb shell input keyevent ${keyCommand}`,
                    { encoding: 'utf8' }
                  );
                }
              } catch (error) {
                console.error('Failed to send key event:', error);
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );

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

      // Get screen dimensions
      try {
        const dimensions = child_process.execSync('adb shell wm size', { encoding: 'utf8' });
        const match = dimensions.match(/Physical size: (\d+)x(\d+)/);
        if (match) {
          const [_, width, height] = match;
          emulatorPanel.webview.postMessage({
            type: 'updateScreen',
            screenWidth: parseInt(width),
            screenHeight: parseInt(height)
          });
        }
      } catch (error) {
        console.error('Failed to get screen dimensions:', error);
      }

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
			#emulator-container {
				position: relative;
				display: inline-block;
			}
			#emulator-screen {
				max-width: 100%;
				max-height: 100vh;
				object-fit: contain;
				cursor: pointer;
			}
			.overlay {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				cursor: pointer;
			}
		</style>
	</head>
	<body>
		<div id="emulator-container">
			<img id="emulator-screen" src="" alt="Android Emulator Screen">
			<div class="overlay" id="interaction-overlay"></div>
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			const overlay = document.getElementById('interaction-overlay');
			const screen = document.getElementById('emulator-screen');
			let screenWidth = 0;
			let screenHeight = 0;

			window.addEventListener('message', event => {
				const message = event.data;
				if (message.type === 'updateScreen') {
					screen.src = message.imageData;
					screenWidth = message.screenWidth || screenWidth;
					screenHeight = message.screenHeight || screenHeight;
				}
			});

			overlay.addEventListener('click', (event) => {
				const rect = overlay.getBoundingClientRect();
				const scaleX = screenWidth / rect.width;
				const scaleY = screenHeight / rect.height;
				const x = Math.round((event.clientX - rect.left) * scaleX);
				const y = Math.round((event.clientY - rect.top) * scaleY);

				vscode.postMessage({
					type: 'click',
					x,
					y
				});
			});

			window.addEventListener('keydown', (event) => {
				vscode.postMessage({
					type: 'keydown',
					key: event.key,
					keyCode: event.keyCode
				});
				event.preventDefault();
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
