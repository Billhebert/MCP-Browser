# Navigation & Interaction Tools

| Tool | Description | Arguments |
|------|-------------|-----------|
| `navigate` | Navigate to URL | `url`, `timeout?` |
| `click` | Click element (3 fallbacks) | `selector`, `force?` |
| `fill` | Fill form field | `selector`, `value` |
| `select` | Select dropdown option | `selector`, `value` |
| `hover` | Hover over element | `selector` |
| `press_key` | Press key or shortcut | `key`, `selector?` |
| `scroll_to` | Scroll to position/element | `selector?`, `position?`, `x?`, `y?` |
| `highlight` | Highlight element | `selector`, `color?` |
| `go_back` | Go back to previous page | — |
| `refresh` | Reload current page | — |
| `drag_and_drop` | Drag element onto target | `source`, `target` |
| `upload_file` | Upload file to input | `selector`, `filePath` |
| `new_tab` | Open new tab | `url?` |
| `close` | Close browser | — |
| `wait` | Wait for event/timeout | `type`, `value?` |
| `wait_for_element` | Wait for element in DOM | `selector`, `timeout?` |
