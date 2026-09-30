// logo：原作社群區裡有對應 3D 標誌的就寫它的物件名稱，連結點會放在標誌旁邊；
// 沒有的就在 angle（度，0 在右、90 在後方）那個空石座上放一塊立牌，color 是立牌底色。
// 原作 8 個石座在半徑約 7.85 的半圓上，角度是 0、25.7、51.4、77.1、102.9、128.6（GitHub 標誌）、154.3、180
export default [
    { name: 'GitHub', url: 'https://github.com/yazelin', align: 'right', logo: 'gitHub' },
    { name: 'Facebook', url: 'https://www.facebook.com/yaze.lin.gm', align: 'right', angle: 25.7, color: '#1877f2', label: 'Facebook' },
    { name: '部落格', url: 'https://yazelin.github.io/', align: 'left', angle: 51.4, color: '#e8743b', label: '部落格' },
    { name: 'Buy Me a Coffee', url: 'https://buymeacoffee.com/yazelin', align: 'left', angle: 77.1, color: '#f5c542', label: 'Buy Me\na Coffee', dark: true },
]
