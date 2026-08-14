# TODAY Toolbox color palette

Reference palette for the toolbox and its tools. Six ramps (red, purple, blue, amber, green, gray), each with six steps from lightest (100) to most saturated (600).

Defined as CSS custom properties in `assets/toolbox.css`, under `:root`. Semantic tokens (`--bg`, `--accent`, `--text`, etc.) are built from these ramps — change the ramp values there to re-theme every page at once.

## Red
| Step | Hex |
|------|---------|
| 100 | `#FFECEA` |
| 200 | `#FFC7C2` |
| 300 | `#FF8F84` |
| 400 | `#FF6859` |
| 500 | `#FF513C` |
| 600 | `#FF3A2C` |

## Purple
| Step | Hex |
|------|---------|
| 100 | `#F8E8FD` |
| 200 | `#E4C7F0` |
| 300 | `#C8A2D7` |
| 400 | `#AE7DC9` |
| 500 | `#7F479E` |
| 600 | `#652E84` |

## Blue
| Step | Hex |
|------|---------|
| 100 | `#EEF9FF` |
| 200 | `#C9EDFA` |
| 300 | `#8CDCF7` |
| 400 | `#63CFF5` |
| 500 | `#4ACAF1` |
| 600 | `#2CC4F1` |

## Amber
| Step | Hex |
|------|---------|
| 100 | `#FFF6EA` |
| 200 | `#FFE3C0` |
| 300 | `#FFC87E` |
| 400 | `#FFB64D` |
| 500 | `#FEAE30` |
| 600 | `#FEA300` |

## Green
| Step | Hex |
|------|---------|
| 100 | `#E4EFEA` |
| 200 | `#ADD1C0` |
| 300 | `#58A380` |
| 400 | `#008357` |
| 500 | `#00733E` |
| 600 | `#006327` |

## Gray
| Step | Hex |
|------|---------|
| 100 | `#F0F2F5` |
| 200 | `#D8DDE5` |
| 300 | `#ABB4C2` |
| 400 | `#7B838F` |
| 500 | `#4A515C` |
| 600 | `#363B43` |

## Current semantic usage

- `--bg`: white (`#FFFFFF`)
- `--bg-elevated`: gray-100
- `--border`: gray-200
- `--text`: gray-600
- `--text-dim`: gray-400
- `--accent` / `--accent-dark`: red-500 / red-600
- `--focus`: blue-500

Purple, amber, and green ramps aren't in use yet — reserved for future tools (status colors, additional accents, etc).
