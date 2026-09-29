import * as THREE from 'three/webgpu'

const text = `
╔═ 你好 ════════════════╗
║ 謝謝你打開開發者工具偷看！
║ 這是林亞澤（Yaze Lin）的 3D 作品集，改自 Bruno Simon 的 folio-2025（MIT）。
╚═══════════════════════╝

╔═ 連結 ════════════════╗
║ 部落格   ⇒ https://yazelin.github.io/
║ GitHub   ⇒ https://github.com/yazelin
║ Facebook ⇒ https://www.facebook.com/yaze.lin.gm
║ 原始碼   ⇒ https://github.com/yazelin/drive-folio-2025
║ 原作     ⇒ https://github.com/brunosimon/folio-2025
╚═══════════════════════╝

╔═ 除錯 ════════════════╗
║ 網址後面加 #debug 重新整理就會打開除錯面板，按 [V] 切換自由鏡頭。
║ Three.js release: ${THREE.REVISION}
╚═══════════════════════╝
`
let finalText = ''
let finalStyles = []
const stylesSet = {
    letter: 'color: #ffffff; font: 400 1em monospace;',
    pipe: 'color: #D66FFF; font: 400 1em monospace;',
}
let currentStyle = null
for(let i = 0; i < text.length; i++)
{
    const char = text[i]

    const style = char.match(/[╔║═╗╚╝╔╝]/) ? 'pipe' : 'letter'
    if(style !== currentStyle)
    {
        currentStyle = style
        finalText += '%c'

        finalStyles.push(stylesSet[currentStyle])
    }
    finalText += char
}

export default [finalText, ...finalStyles]