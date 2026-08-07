// The version rides in the fragment, which is already how the main process tells a window
// what it is rendering. No preload, no channel: this page only ever paints one string.
const version = document.getElementById('version')
if (version) version.textContent = decodeURIComponent(window.location.hash.slice(1))
