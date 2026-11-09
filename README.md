# Window Bucket

A Chrome (Manifest V3) extension that saves every tab in the current window as a "bucket" so you can close the window and bring it back later.

## Features

- **Save & close window**: saves all tabs (URL, title, pinned state, favicon) and closes the window.
- **Save only**: saves the bucket and leaves the window open.
- **Restore**: reopens a bucket's tabs in a new window, keeping pinned tabs pinned. The bucket stays saved.
- Expand a bucket to see its tabs, and click one to open just that tab.
- Double-click a bucket name to rename it.
- Delete a bucket by clicking ✕ twice.
- Keyboard shortcut: `Alt+Shift+B` opens the popup. In the popup, press `Enter` to save and close.

Buckets are kept in `chrome.storage.local`, so they persist across browser restarts on this device.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Pin the extension from the puzzle-piece menu.

It also works in other Chromium browsers (Edge, Brave, Arc).
