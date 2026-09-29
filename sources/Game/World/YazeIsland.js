import * as THREE from 'three/webgpu'
import { color, texture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Game } from '../Game.js'
import { InteractivePoints } from '../InteractivePoints.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { Trees } from './Trees.js'
import { YazeCity, CITY } from './YazeCity.js'
import repoData from '../../../tools/repos.json'
import cats from '../../../tools/cats.json'
import lives from '../../../tools/lives.json'

// Yaze 島:原作的島已經擺滿,我們的東西蓋在北邊海上另一座島,用傳送點來回。
// 島上有 repo 城市、角色廣場、catime 貓圖牆、週三直播路。全部用程式產生,不用 Blender。
//
// 座標:x 往東、z 往南、y 朝上。鏡頭固定從東南方(+x +z)斜看,所以地上的字轉 45 度才會正對畫面。

const CENTER = new THREE.Vector3(0, 0, - 190)   // 島中心(世界座標)
const HALF = { x: 82, z: 62 }                   // 島的半寬、南邊到中心的距離
const NORTH = - 95                               // 島的北岸(往北加大放 repo 城市)
const FACING = Math.PI * 0.25                   // 正對鏡頭的角度
const MAP_SPAN = 176                            // 島地圖涵蓋的正方形邊長(公尺)
const MAP_CZ = (NORTH + 62) / 2                  // 島地圖中心的 z(島不是對稱的)

const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'

export class YazeIsland
{
    constructor()
    {
        this.game = Game.getInstance()
        this.materials = new Map()
        this.geometries = new Map()      // 顏色 → 要合併的幾何
        this.colliders = []              // 固定不動的碰撞盒
        this.footprints = []            // 地圖用:每個方塊的俯視輪廓
        this.mapLabels = []             // 地圖上的字
        this.mapPins = []               // 地圖上可以點的地點

        this.setGround()
        this.setCity()
        this.setCharacters()
        this.setCatWall()
        this.setLiveRoad()
        this.setPortals()
        this.setTrees()
        this.flush()

    }

    // 島上座標 → 世界座標
    world(x, y, z)
    {
        return new THREE.Vector3(CENTER.x + x, CENTER.y + y, CENTER.z + z)
    }

    material(hex)
    {
        if(!this.materials.has(hex))
            this.materials.set(hex, new MeshDefaultMaterial({ colorNode: color(hex), hasWater: false }))
        return this.materials.get(hex)
    }

    // 收集一個方塊(島上座標、底面貼地),最後同色合併成一個網格
    box(hex, x, z, w, h, d, y = 0, collide = false)
    {
        const geometry = new THREE.BoxGeometry(w, h, d)
        geometry.translate(CENTER.x + x, CENTER.y + y + h / 2, CENTER.z + z)
        this.footprints.push([ hex, x, z, w, d, y + h ])
        if(!this.geometries.has(hex))
            this.geometries.set(hex, [])
        this.geometries.get(hex).push(geometry)

        if(collide)
            this.colliders.push({ shape: 'cuboid', parameters: [ w / 2, h / 2, d / 2 ], position: this.world(x, y + h / 2, z) })
    }

    flush()
    {
        for(const [ hex, list ] of this.geometries)
        {
            const mesh = new THREE.Mesh(mergeGeometries(list.map(g => g.toNonIndexed())), this.material(hex))
            mesh.castShadow = true
            mesh.receiveShadow = true
            this.game.scene.add(mesh)
        }

        this.game.objects.add(null, { type: 'fixed', friction: 0.25, restitution: 0.15, colliders: this.colliders })
    }

    // 白字黑底的畫布,當 alpha 用
    textTexture(lines, width = 1024, height = 256)
    {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const sizes = lines.length === 1 ? [ 0.6 ] : [ 0.44, 0.24, 0.24 ]
        const rows = lines.length === 1 ? [ 0.5 ] : lines.length === 2 ? [ 0.36, 0.78 ] : [ 0.26, 0.6, 0.84 ]
        lines.forEach((text, i) =>
        {
            let size = height * sizes[i]
            ctx.font = `900 ${size}px ${FONT}`
            while(ctx.measureText(text).width > width * 0.95 && size > 8)
            {
                size -= 2
                ctx.font = `900 ${size}px ${FONT}`
            }
            ctx.fillText(text, width / 2, height * rows[i])
        })
        const map = new THREE.CanvasTexture(canvas)
        map.anisotropy = 4
        return map
    }

    // 地上的字(畫在地面上,轉向鏡頭)
    floorText(lines, x, z, w, h, hex = '#3d2a45')
    {
        const map = this.textTexture(lines, 1024, Math.round(1024 * h / w))
        const material = new MeshDefaultMaterial({ colorNode: color(hex), alphaNode: texture(map).r, hasWater: false, transparent: true, depthWrite: false })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
        mesh.rotation.reorder('YXZ')
        mesh.rotation.x = - Math.PI / 2
        mesh.rotation.y = FACING
        mesh.position.copy(this.world(x, 0.06, z))
        mesh.receiveShadow = true
        this.game.scene.add(mesh)
        return mesh
    }

    point(x, y, z, text, callback, align = InteractivePoints.ALIGN_RIGHT)
    {
        return this.game.interactivePoints.create(
            this.world(x, y, z),
            text,
            align,
            InteractivePoints.STATE_CONCEALED,
            callback,
            () => this.game.inputs.interactiveButtons.addItems([ 'interact' ]),
            () => this.game.inputs.interactiveButtons.removeItems([ 'interact' ]),
            () => this.game.inputs.interactiveButtons.removeItems([ 'interact' ])
        )
    }

    setGround()
    {
        // 島身(沙色)＋周圍一圈矮牆,免得開進海裡
        const depth = HALF.z - NORTH
        const midZ = (HALF.z + NORTH) / 2
        this.box('#b3a044', 0, midZ, HALF.x * 2, 3, depth, - 3)

        // 各區底下鋪石板廣場:開場、角色廣場、貓圖牆
        const slab = '#e9c49a'
        this.box(slab, 0, 50, 18, 0.05, 16, 0)
        this.box(slab, - 48, 49, 38, 0.05, 18, 0)
        this.box(slab, 50, 45, 32, 0.05, 18, 0)
        this.colliders.push({ shape: 'cuboid', parameters: [ HALF.x, 1, depth / 2 ], position: this.world(0, - 1, midZ), category: 'floor' })
        const wall = '#b86a3c'
        this.box(wall, 0, NORTH, HALF.x * 2, 0.8, 0.6, 0, true)
        this.box(wall, 0, HALF.z, HALF.x * 2, 0.8, 0.6, 0, true)
        this.box(wall, - HALF.x, midZ, 0.6, 0.8, depth, 0, true)
        this.box(wall, HALF.x, midZ, 0.6, 0.8, depth, 0, true)

        // 島名
        this.floorText([ 'YAZE 島', 'repo 城市・角色廣場・貓圖牆・週三直播路' ], 0, 38, 20, 5)
    }

    setCity()
    {
        this.city = new YazeCity(this)
        this.pin('repo 城市', CITY.x0 + 3, CITY.z1 - 3, CITY.x0 + 22, CITY.z1 - 6)
        this.floorText([ 'REPO 城市', `${repoData.repos.length} 個公開 repo：樓越高星越多，樓頂有綠色燈圈的有網頁`, '開到樓前的白色菱形按 Enter 打開' ], 26, 36, 18, 4.5)
    }

    setCharacters()
    {
        // 名字與介紹照 yazelin.github.io/characters/ 各角色頁的副標
        const characters = [
            { id: 'glitch', name: '格莉奇', line: '只有 4KB 記憶體的 AI 機器人少女，話說得很滿，下一秒就當機。', height: 4.5 },
            { id: 'blackhole', name: '黑洞先生', line: '黑洞的具現化。有正職，脾氣好，會把你忘掉的東西吃掉。', height: 5.0 },
            { id: 'mori', name: 'Mori', line: '森林裡的精靈，也是我的桌面同伴。她的工作是記得。', height: 4.6 },
            { id: 'yori', name: '優理', line: '森林宇宙裡的年輕學徒，正在把「有理」一點點練出來。', height: 4.4 }
        ]
        const loader = new THREE.TextureLoader()
        const x0 = - 62
        const z = 46

        this.floorText([ '角色廣場', '開到她們旁邊按 Enter 看角色介紹' ], x0 + 12, z - 7, 14, 3.5)
        this.pin('角色廣場', x0 + 12, z - 3)

        characters.forEach((c, i) =>
        {
            const x = x0 + i * 9.5

            // 底座
            this.box('#fff4e0', x, z, 2.6, 0.5, 1.8, 0, true)

            // 紙板立牌:永遠面向鏡頭
            const map = loader.load(`yaze/characters/${c.id}.webp`, (t) =>
            {
                standee.scale.set(c.height * t.image.width / t.image.height, c.height, 1)
            })
            map.colorSpace = THREE.SRGBColorSpace
            const standee = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
                new THREE.MeshBasicNodeMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide })
            )
            standee.rotation.y = FACING
            standee.position.copy(this.world(x, 0.5, z))
            standee.castShadow = true
            this.game.scene.add(standee)

            this.floorText([ c.name, c.line ], x + 1.5, z + 3.2, 8, 2)
            this.point(x, 2.5, z + 1.5, c.name, () => window.open(`https://yazelin.github.io/characters/${c.id}/`, '_blank'))
        })
    }

    setCatWall()
    {
        // 一面白牆掛最新 12 隻 catime 的貓,牆面正對鏡頭
        const perRow = 6
        const frame = 2.4
        const gap = 0.4
        const rows = Math.ceil(cats.length / perRow)
        const width = perRow * (frame + gap) + gap
        const height = rows * (frame + gap) + gap + 0.8
        const cx = 50
        const cz = 42

        const group = new THREE.Group()
        group.position.copy(this.world(cx, 0, cz))
        group.rotation.y = FACING
        this.game.scene.add(group)

        const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.5), this.material('#fff4e0'))
        wall.position.y = height / 2
        wall.castShadow = true
        wall.receiveShadow = true
        group.add(wall)

        const loader = new THREE.TextureLoader()
        cats.forEach((cat, i) =>
        {
            const map = loader.load(`yaze/cats/${cat.file}`)
            map.colorSpace = THREE.SRGBColorSpace
            const picture = new THREE.Mesh(new THREE.PlaneGeometry(frame, frame), new THREE.MeshBasicNodeMaterial({ map }))
            picture.position.set(
                - width / 2 + gap + frame / 2 + (i % perRow) * (frame + gap),
                height - 0.8 - gap - frame / 2 - Math.floor(i / perRow) * (frame + gap),
                0.26
            )
            group.add(picture)
        })

        this.colliders.push({
            shape: 'cuboid',
            parameters: [ width / 2, height / 2, 0.25 ],
            position: this.world(cx, height / 2, cz),
            quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), FACING)
        })

        this.floorText([ 'catime 貓圖牆', `每小時自動生一隻 AI 貓，這裡是最新 ${cats.length} 隻` ], cx + 4, cz + 5, 14, 3.5)
        this.pin('貓圖牆', cx + 2, cz + 6)
        this.point(cx + 3, 2, cz + 3, 'catime 貓圖庫', () => window.open('https://yazelin.github.io/catime/', '_blank'))
    }

    setLiveRoad()
    {
        // 島的東側一條路,每場直播一根會被撞倒的里程碑,最新一場是橘色
        const x = 75
        const z0 = 44
        const step = - 9

        this.box('#4a4058', x, z0 + step * (lives.length - 1) / 2, 6, 0.04, Math.abs(step) * lives.length + 4, 0)
        this.floorText([ '週三直播路', `${lives.length} 場，每週三晚上八點` ], x - 1, z0 + 7, 10, 2.5, '#fff4e0')
        this.pin('週三直播路', x, z0 + 4)

        const geometry = new THREE.BoxGeometry(0.7, 2, 0.7)
        lives.forEach((live, i) =>
        {
            const z = z0 + i * step
            const pillar = new THREE.Mesh(geometry, this.material(i === lives.length - 1 ? '#ff8039' : '#fff4e0'))
            pillar.castShadow = true
            pillar.receiveShadow = true
            this.game.objects.add(
                { model: pillar, updateMaterials: false },
                {
                    type: 'dynamic',
                    position: this.world(x + 2, 1, z),
                    friction: 0.7,
                    mass: 0.2,
                    sleeping: true,
                    colliders: [ { shape: 'cuboid', parameters: [ 0.35, 1, 0.35 ] } ]
                }
            )
            this.floorText([ live.date, live.title ], x - 1, z, 6.5, 1.6, '#fff4e0')
            this.point(x + 2, 2.4, z, `${live.date} ${live.title}`, () => window.open(live.href, '_blank'))
        })
    }

    setPortals()
    {
        // 島上的重生點 'yaze' 登記在 Respawns.js(按 R 或卡住時會回到最近的重生點)

        // 島上 → 主島
        this.pin('開場', 0, 48)
        const back = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.25, 24), this.game.materials.list.get('emissivePurpleRadialGradient'))
        back.position.copy(this.world(4, 0.12, 54))
        this.game.scene.add(back)
        this.point(4, 1.4, 54, '回主島', () => this.game.player.respawn('landing'))

        // 主島開場 → Yaze 島:放在原本 BRUNO 的 B 那格(字母換成 YAZE LIN 後空出來)
        const portal = new THREE.Vector3(38.4, 0, 44.2)
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.25, 24), this.game.materials.list.get('emissivePurpleRadialGradient'))
        pad.position.set(portal.x, 0.12, portal.z)
        pad.castShadow = true
        this.game.scene.add(pad)
        this.game.interactivePoints.create(
            new THREE.Vector3(portal.x, 1.4, portal.z),
            '前往 Yaze 島',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () => this.game.player.respawn('yaze'),
            () => this.game.inputs.interactiveButtons.addItems([ 'interact' ]),
            () => this.game.inputs.interactiveButtons.removeItems([ 'interact' ]),
            () => this.game.inputs.interactiveButtons.removeItems([ 'interact' ])
        )
    }

    setTrees()
    {
        // 借原作的三種樹(會隨風擺、車靠近會透明),種在城市外圍,島才不會像沙漠
        const spots = []
        for(let z = NORTH + 4; z <= 26; z += 8)
            spots.push([ 66, z ])                                       // 城市與直播路之間一排
        for(let x = - 78; x <= 66; x += 8)
            if(x < - 8 || x > 12)
                spots.push([ x, 59 ])                                   // 南岸一排(避開傳送台)
        spots.push([ - 22, 36 ], [ - 8, 35 ], [ 12, 35 ], [ 42, 35 ], [ - 72, 36 ], [ - 30, 54 ], [ 20, 54 ])

        const kinds = [
            [ 'Island Oak', this.game.resources.oakTreesVisualModel.scene, '#b4b536', '#d8cf3b' ],
            [ 'Island Cherry', this.game.resources.cherryTreesVisualModel.scene, '#ff6d6d', '#ff9990' ],
            [ 'Island Birch', this.game.resources.birchTreesVisualModel.scene, '#ff4f2b', '#ff903f' ]
        ]
        const groups = kinds.map(() => [])
        spots.forEach(([ x, z ], i) =>
        {
            const reference = new THREE.Object3D()
            reference.position.copy(this.world(x, 0, z))
            reference.rotation.y = i * 2.4
            reference.scale.setScalar(0.8 + (i % 3) * 0.15)
            reference.updateMatrixWorld(true)
            groups[i % 3].push(reference)
        })
        kinds.forEach(([ name, model, a, b ], i) => new Trees(name, model, groups[i], a, b))
    }

    // 地圖上可以點的地點:登記成重生點,地圖點下去就走原作的重生流程
    pin(name, x, z, labelX = x, labelZ = z - 6)
    {
        const key = `yaze${this.mapPins.length}`
        const position = this.world(x, 4, z)
        this.game.respawns.items.set(key, { name: key, position, rotation: Math.PI })
        this.mapPins.push({ name, key, x, z })
        this.mapLabels.push([ name, labelX, labelZ ])
    }

    // 島的俯視圖:把蓋島用的方塊依高度由低到高畫出來。回傳圖片網址給 Map.js
    getMapUrl()
    {
        if(this.mapUrl)
            return this.mapUrl

        const size = 1024
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const scale = size / MAP_SPAN
        const toPx = (v) => (v + MAP_SPAN / 2) * scale
        const toPy = (v) => (v - MAP_CZ + MAP_SPAN / 2) * scale

        ctx.fillStyle = '#2b5d7a'
        ctx.fillRect(0, 0, size, size)

        const detail = [ '#2b2540', '#fff4e0', '#9aa0a6' ]
        const list = [ ...this.footprints ]
            .filter(([ hex, x, z, w ]) => !(detail.includes(hex) && w > 0.3 && w < 2.6))
            .sort((a, b) => a[5] - b[5])
        for(const [ hex, x, z, w, d ] of list)
        {
            ctx.fillStyle = hex
            ctx.fillRect(toPx(x - w / 2), toPy(z - d / 2), w * scale, d * scale)
        }

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `900 22px ${FONT}`
        ctx.lineWidth = 5
        ctx.strokeStyle = 'rgba(30, 20, 40, 0.85)'
        ctx.fillStyle = '#ffffff'
        for(const [ text, x, z ] of this.mapLabels)
        {
            ctx.strokeText(text, toPx(x), toPy(z))
            ctx.fillText(text, toPx(x), toPy(z))
        }

        this.mapUrl = canvas.toDataURL('image/webp', 0.9)
        return this.mapUrl
    }

    // 世界座標 → 島地圖上的比例(0~1)
    worldToMap(x, z)
    {
        return {
            x: Math.min(Math.max((x - CENTER.x) / MAP_SPAN + 0.5, 0), 1),
            y: Math.min(Math.max((z - CENTER.z - MAP_CZ) / MAP_SPAN + 0.5, 0), 1)
        }
    }

    isOn(position)
    {
        return Math.abs(position.x - CENTER.x) < MAP_SPAN / 2 && Math.abs(position.z - CENTER.z - MAP_CZ) < MAP_SPAN / 2
    }
}
