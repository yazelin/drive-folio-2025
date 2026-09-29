import * as THREE from 'three/webgpu'
import { attribute, cameraPosition, color, dot, Fn, luminance, positionWorld, texture, uniform, vec3 } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import repoData from '../../../tools/repos.json'

// repo 城市:搬自 2026-09-29 的從零實測版(另一個 agent 照同樣三句話做的),yazelin 覺得比我們原本的好。
// 一個街區 4 棟、每棟正面朝南邊的街(鏡頭從東南斜看);有 GitHub Pages 的樓頂有綠色燈圈;
// 車開在樓後面時,擋在車和鏡頭之間的樓會挖一個洞。座標都是島上座標(YazeIsland 的 world() 換成世界座標)。

export const CITY = { x0: - 78, z0: - 91, road: 6, lot: 4.5, sidewalk: 1.2, columns: 5, rows: 9, perBlock: 4 }
CITY.blockWidth = CITY.perBlock * CITY.lot + CITY.sidewalk * 2
CITY.blockDepth = CITY.lot + CITY.sidewalk * 2
CITY.pitchX = CITY.blockWidth + CITY.road
CITY.pitchZ = CITY.blockDepth + CITY.road
CITY.x1 = CITY.x0 + CITY.road + CITY.columns * CITY.pitchX
CITY.z1 = CITY.z0 + CITY.road + CITY.rows * CITY.pitchZ

const FACADE_COLORS = [ '#e9d8bd', '#f0b98a', '#c9d4de', '#d9927a', '#b9c7a2', '#e3c7dc', '#a6bdd3', '#f3e2a4', '#cfb8a0', '#9fb7a8' ]
const GLASS = '#2e3d5c'
const GLASS_WARM = '#5a4a6e'
const TRIM = '#f7f1e6'
const ASPHALT = '#4a4452'
const SIDEWALK = '#b9ada4'
const LINE = '#f4efe6'
const FACE_CAMERA = Math.PI * 0.25
const FONT = '"Nunito", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'

function blockOrigin(column, row)
{
    return { x: CITY.x0 + CITY.road + column * CITY.pitchX, z: CITY.z0 + CITY.road + row * CITY.pitchZ }
}

function lotCenter(column, row, index)
{
    const origin = blockOrigin(column, row)
    return { x: origin.x + CITY.sidewalk + CITY.lot * (index + 0.5), z: origin.z + CITY.sidewalk + CITY.lot * 0.5 }
}

// 名字 → 固定的亂數,同一個 repo 每次長得一樣
function seeded(text)
{
    let h = 2166136261
    for(let i = 0; i < text.length; i++)
    {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    let s = Math.floor((h >>> 0) / 4294967295 * 2147483646) + 1
    return () =>
    {
        s = (s * 16807) % 2147483647
        return (s - 1) / 2147483646
    }
}

// 很多小方塊各帶一個顏色,最後合併成一個網格
class Batch
{
    constructor()
    {
        this.geometries = []
    }

    add(geometry, hex, x, y, z)
    {
        const g = geometry.index ? geometry.toNonIndexed() : geometry
        g.translate(x, y, z)
        const c = new THREE.Color(hex)
        const colors = new Float32Array(g.attributes.position.count * 3)
        for(let i = 0; i < colors.length; i += 3)
        {
            colors[i] = c.r
            colors[i + 1] = c.g
            colors[i + 2] = c.b
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        this.geometries.push(g)
    }

    box(w, h, d, hex, x, y, z)
    {
        this.add(new THREE.BoxGeometry(w, h, d), hex, x, y, z)
    }

    cylinder(rt, rb, h, segments, hex, x, y, z)
    {
        this.add(new THREE.CylinderGeometry(rt, rb, h, segments), hex, x, y, z)
    }

    build(material, castShadow = true)
    {
        const mesh = new THREE.Mesh(mergeGeometries(this.geometries, false), material)
        mesh.castShadow = castShadow
        mesh.receiveShadow = true
        return mesh
    }
}

function emissive(hex, intensity)
{
    const material = new THREE.MeshBasicNodeMaterial()
    const base = color(hex)
    material.colorNode = base.div(luminance(base)).mul(intensity)
    material.fog = false
    return material
}

export class YazeCity
{
    constructor(island)
    {
        this.game = Game.getInstance()
        this.island = island

        // 島上座標直接用;整個城市掛在島中心
        this.root = new THREE.Group()
        this.root.position.copy(island.world(0, 0, 0))
        this.game.scene.add(this.root)

        this.solid = new Batch()        // 有影子、會被挖洞的樓
        this.flat = new Batch()         // 地面:柏油、人行道、線
        this.glow = new Batch()         // 路燈
        this.pagesGlow = new Batch()    // 有網頁的樓頂燈圈
        this.cutaway = uniform(vec3(0, 0, 0))

        // 最近有更新的排前面
        this.repos = [ ...repoData.repos ].sort((a, b) => (b.pushed || '').localeCompare(a.pushed || ''))

        this.setGround()
        this.setBuildings()
        this.build()

        this.game.ticker.events.on('tick', () =>
        {
            this.cutaway.value.copy(this.game.player.position)
        }, 10)
    }

    setGround()
    {
        const w = CITY.x1 - CITY.x0
        const d = CITY.z1 - CITY.z0
        this.flat.box(w, 0.04, d, ASPHALT, CITY.x0 + w / 2, 0.02, CITY.z0 + d / 2)
        this.island.footprints.push([ ASPHALT, CITY.x0 + w / 2, CITY.z0 + d / 2, w, d, 0.04 ])

        // 車道虛線
        for(let row = 0; row <= CITY.rows; row++)
        {
            const z = CITY.z0 + CITY.road / 2 + row * CITY.pitchZ
            for(let x = CITY.x0 + 4; x < CITY.x1 - 3; x += 5)
                this.flat.box(2, 0.02, 0.16, LINE, x, 0.05, z)
        }
        for(let column = 0; column <= CITY.columns; column++)
        {
            const x = CITY.x0 + CITY.road / 2 + column * CITY.pitchX
            for(let z = CITY.z0 + 4; z < CITY.z1 - 3; z += 5)
                this.flat.box(0.16, 0.02, 2, LINE, x, 0.05, z)

            // 每個路口南側的斑馬線
            for(let row = 0; row < CITY.rows; row++)
            {
                const zc = CITY.z0 + CITY.road + row * CITY.pitchZ + CITY.blockDepth + 1.2
                for(let s = - 2; s <= 2; s++)
                    this.flat.box(0.5, 0.02, 1.8, LINE, x + s * 1.05, 0.051, zc)
            }
        }
    }

    setBuildings()
    {
        // 屋頂招牌:所有名字畫在一張圖上,每棟取一格
        const cellW = 384
        const cellH = 80
        const perRow = 5
        const canvas = document.createElement('canvas')
        canvas.width = cellW * perRow
        canvas.height = cellH * Math.ceil(this.repos.length / perRow)
        const context = canvas.getContext('2d')
        const signs = []

        let index = 0
        for(let row = 0; row < CITY.rows; row++)
        {
            for(let column = 0; column < CITY.columns; column++)
            {
                const origin = blockOrigin(column, row)

                // 人行道與路緣
                this.flat.box(CITY.blockWidth, 0.14, CITY.blockDepth, SIDEWALK, origin.x + CITY.blockWidth / 2, 0.07, origin.z + CITY.blockDepth / 2)
                this.flat.box(CITY.blockWidth + 0.1, 0.1, 0.18, '#8d8279', origin.x + CITY.blockWidth / 2, 0.05, origin.z + CITY.blockDepth)
                this.island.footprints.push([ SIDEWALK, origin.x + CITY.blockWidth / 2, origin.z + CITY.blockDepth / 2, CITY.blockWidth, CITY.blockDepth, 0.14 ])

                // 街區南邊兩個角的路燈
                for(const side of [ 0, 1 ])
                {
                    const lx = origin.x + 0.5 + side * (CITY.blockWidth - 1)
                    const lz = origin.z + CITY.blockDepth - 0.5
                    this.solid.cylinder(0.07, 0.1, 3.6, 6, '#3d3645', lx, 1.8, lz)
                    this.solid.box(0.9, 0.08, 0.1, '#3d3645', lx + (side ? - 0.4 : 0.4), 3.55, lz)
                    this.glow.box(0.34, 0.18, 0.3, '#ffcf87', lx + (side ? - 0.8 : 0.8), 3.45, lz)
                }

                for(let i = 0; i < CITY.perBlock; i++)
                {
                    const repo = this.repos[index]
                    if(!repo)
                    {
                        // 空地做成小公園
                        const lot = lotCenter(column, row, i)
                        this.flat.box(CITY.lot - 0.4, 0.16, CITY.lot - 0.4, '#7fa045', lot.x, 0.08, lot.z)
                        this.island.footprints.push([ '#7fa045', lot.x, lot.z, CITY.lot - 0.4, CITY.lot - 0.4, 0.16 ])
                        continue
                    }
                    const building = this.building(repo, column, row, i)
                    const cx = (index % perRow) * cellW
                    const cy = Math.floor(index / perRow) * cellH
                    this.drawSign(context, repo, cx, cy, cellW, cellH)
                    signs.push({ building, u0: cx / canvas.width, v0: cy / canvas.height, u1: (cx + cellW) / canvas.width, v1: (cy + cellH) / canvas.height })
                    index++
                }
            }
        }

        // 屋頂招牌合成一個網格
        const geometries = []
        for(const sign of signs)
        {
            const b = sign.building
            const geometry = new THREE.PlaneGeometry(3.7, 3.7 * cellH / cellW)
            const uv = geometry.attributes.uv
            uv.setXY(0, sign.u0, 1 - sign.v0)
            uv.setXY(1, sign.u1, 1 - sign.v0)
            uv.setXY(2, sign.u0, 1 - sign.v1)
            uv.setXY(3, sign.u1, 1 - sign.v1)
            geometry.rotateY(FACE_CAMERA)
            geometry.translate(b.x + 0.2, b.height + 1.45, b.z + 0.2)
            geometries.push(geometry.toNonIndexed())

            // 招牌的兩支腳
            const offset = new THREE.Vector3(Math.cos(FACE_CAMERA), 0, - Math.sin(FACE_CAMERA)).multiplyScalar(1.4)
            for(const direction of [ - 1, 1 ])
                this.solid.box(0.1, 1.1, 0.1, '#3d3645', b.x + 0.1 + offset.x * direction, b.height + 0.55, b.z + 0.1 + offset.z * direction)
        }
        const map = new THREE.CanvasTexture(canvas)
        map.colorSpace = THREE.SRGBColorSpace
        map.anisotropy = 4
        const material = new THREE.MeshBasicNodeMaterial()
        material.colorNode = texture(map).rgb.mul(0.92)
        material.fog = false
        const signMesh = new THREE.Mesh(mergeGeometries(geometries, false), material)
        this.root.add(signMesh)
    }

    drawSign(context, repo, x, y, w, h)
    {
        context.save()
        context.translate(x, y)
        context.fillStyle = repo.home ? '#1f6f5c' : '#2a2233'
        context.fillRect(0, 0, w, h)
        context.strokeStyle = repo.home ? '#8dffd9' : '#ffd36b'
        context.lineWidth = 5
        context.strokeRect(4, 4, w - 8, h - 8)
        context.fillStyle = '#ffffff'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        let size = repo.home ? 36 : 40
        context.font = `800 ${size}px ${FONT}`
        while(context.measureText(repo.name).width > w - 30 && size > 12)
        {
            size--
            context.font = `800 ${size}px ${FONT}`
        }
        context.fillText(repo.name, w / 2, repo.home ? h * 0.38 : h * 0.52)
        if(repo.home)
        {
            context.fillStyle = '#8dffd9'
            context.font = `700 20px ${FONT}`
            context.fillText('有網頁可以看', w / 2, h * 0.76)
        }
        context.restore()
    }

    building(repo, column, row, lotIndex)
    {
        const lot = lotCenter(column, row, lotIndex)
        const random = seeded(repo.name)
        const width = 3.4 + random() * 0.8
        const depth = 3.2 + random() * 0.8
        const popularity = Math.log2(1 + (repo.stars || 0))
        const floors = Math.max(2, Math.min(8, Math.round(2 + random() * 4 + popularity * 0.8)))
        const height = floors * 2.8 + 0.6
        const x = lot.x
        const z = lot.z - (CITY.lot - depth) * 0.5 + 0.35
        const facade = FACADE_COLORS[Math.floor(random() * FACADE_COLORS.length)]
        const glass = random() > 0.5 ? GLASS : GLASS_WARM
        const style = Math.floor(random() * 3)

        // 樓身;一樓店面、門、朝街的遮雨棚
        this.solid.box(width, height, depth, facade, x, height / 2, z)
        this.island.footprints.push([ facade, x, z, width, depth, height ])
        this.solid.box(width + 0.04, 1.7, depth + 0.04, glass, x, 1.05, z)
        this.solid.box(0.9, 1.9, 0.06, '#3b2f2a', x - width * 0.22, 0.95, z + depth / 2 + 0.03)
        const awning = [ '#d9534f', '#3f8f7a', '#e0a13a', '#5b6fd6' ][Math.floor(random() * 4)]
        this.solid.box(width * 0.86, 0.12, 0.9, awning, x, 2.15, z + depth / 2 + 0.45)

        // 各樓層:玻璃帶、窗格、直條三種樣式
        for(let f = 1; f < floors; f++)
        {
            const y = f * 2.8 + 1.2
            if(style === 0)
            {
                this.solid.box(width + 0.05, 1.1, depth + 0.05, glass, x, y, z)
            }
            else if(style === 1)
            {
                for(let w = 0; w < 3; w++)
                {
                    this.solid.box(width / 3 * 0.55, 1.2, 0.08, glass, x - width / 2 + (w + 0.5) * width / 3, y, z + depth / 2 + 0.02)
                    this.solid.box(0.08, 1.2, depth / 3 * 0.55, glass, x + width / 2 + 0.02, y, z - depth / 2 + (w + 0.5) * depth / 3)
                }
            }
            else
            {
                this.solid.box(width * 0.7, 1.5, depth + 0.05, glass, x, y, z)
            }
            this.solid.box(width + 0.18, 0.12, depth + 0.18, TRIM, x, f * 2.8 + 0.35, z)
        }

        // 女兒牆
        const top = height
        this.solid.box(width + 0.1, 0.35, 0.12, TRIM, x, top + 0.17, z - depth / 2)
        this.solid.box(width + 0.1, 0.35, 0.12, TRIM, x, top + 0.17, z + depth / 2)
        this.solid.box(0.12, 0.35, depth, TRIM, x - width / 2, top + 0.17, z)
        this.solid.box(0.12, 0.35, depth, TRIM, x + width / 2, top + 0.17, z)

        // 屋頂設備:水塔或冷氣機;高樓加天線
        if(random() > 0.5)
        {
            this.solid.cylinder(0.45, 0.45, 0.9, 10, '#8a6f5a', x - width * 0.25, top + 1.0, z - depth * 0.22)
            this.solid.cylinder(0.5, 0.5, 0.1, 10, '#6b5445', x - width * 0.25, top + 1.5, z - depth * 0.22)
            for(const lx of [ - 0.3, 0.3 ])
                this.solid.box(0.06, 0.6, 0.06, '#3d3645', x - width * 0.25 + lx, top + 0.3, z - depth * 0.22)
        }
        else
        {
            this.solid.box(0.9, 0.5, 0.7, '#9aa3ad', x - width * 0.22, top + 0.25, z - depth * 0.2)
            this.solid.box(0.5, 0.5, 0.5, '#7d8791', x + width * 0.2, top + 0.25, z - depth * 0.25)
        }
        if(floors >= 6)
            this.solid.cylinder(0.03, 0.05, 2.2, 5, '#3d3645', x + width * 0.3, top + 1.1, z - depth * 0.3)

        // 有 GitHub Pages 的樓頂燈圈
        if(repo.home)
        {
            this.pagesGlow.box(width + 0.16, 0.14, 0.16, '#6fffd2', x, top + 0.42, z - depth / 2)
            this.pagesGlow.box(width + 0.16, 0.14, 0.16, '#6fffd2', x, top + 0.42, z + depth / 2)
            this.pagesGlow.box(0.16, 0.14, depth, '#6fffd2', x - width / 2, top + 0.42, z)
            this.pagesGlow.box(0.16, 0.14, depth, '#6fffd2', x + width / 2, top + 0.42, z)
        }

        this.island.colliders.push({ shape: 'cuboid', parameters: [ width / 2, height / 2, depth / 2 ], position: this.island.world(x, height / 2, z) })

        // 樓前街上的互動點
        this.island.point(x, 1.4, lot.z + CITY.lot / 2 + CITY.sidewalk + 0.9, `${repo.name}（${repo.home ? '網頁' : 'repo'}）`, () => window.open(repo.home || repo.url, '_blank'))

        return { x, z, height }
    }

    build()
    {
        // 樓:擋在車與鏡頭之間的部分挖洞,車開在樓後面也看得到
        const cutaway = this.cutaway
        const alphaNode = Fn(() =>
        {
            const a = cutaway.add(vec3(0, 0.8, 0))
            const ab = cameraPosition.sub(a)
            const t = dot(positionWorld.sub(a), ab).div(dot(ab, ab)).clamp(0, 1)
            return positionWorld.sub(a.add(ab.mul(t))).length().smoothstep(3.2 * 0.8, 3.2)
        })()
        const vertexColor = (parameters) => new MeshDefaultMaterial({ colorNode: attribute('color', 'vec3'), hasWater: false, ...parameters })

        this.root.add(this.solid.build(vertexColor({ alphaNode, alphaTest: 0.5 })))
        this.root.add(this.flat.build(vertexColor({}), false))
        this.root.add(this.glow.build(emissive('#ffcf87', 2.2), false))
        this.root.add(this.pagesGlow.build(emissive('#6fffd2', 1.6), false))
    }
}
