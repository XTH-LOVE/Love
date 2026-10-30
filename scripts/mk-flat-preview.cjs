// Build a flat preview (no reveal animations) for headless screenshot verification.
// Hash targets scroll the matching element to top by removing its previous siblings.
// Special hash "#foot" targets the <footer> element.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'index.html'), 'utf8');
let out = src.replace("document.documentElement.classList.add('js-ready');", '');
out = out.replace('</head>', "<style>html{scroll-behavior:auto!important}</style>\n<script>window.addEventListener('load',function(){var id=location.hash.slice(1);if(!id)return;var e=id==='foot'?document.querySelector('footer'):document.getElementById(id);if(e){var p=e.previousElementSibling;while(p){var x=p.previousElementSibling;p.remove();p=x}window.scrollTo(0,0)}});</script>\n</head>");
fs.writeFileSync(path.join(__dirname, '..', 'deploy', '_preview-flat.html'), out, 'utf8');
console.log('flat preview written:', out.length, 'chars');
