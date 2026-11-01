import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const WIDTH = 720
const HEIGHT = 720
const FPS = 60
const DURATION_SEC = 16.7
const TOTAL_FRAMES = Math.round(FPS * DURATION_SEC) // 1002 frames
const OUT_MP4 = join(process.cwd(), 'engram-showcase.mp4')

const HTML_PAGE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; overflow: hidden; width: 720px; height: 720px; }
  canvas { display: block; width: 720px; height: 720px; }
</style>
</head>
<body>
<canvas id="c" width="720" height="720"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 720, H = 720;
const TOTAL_FRAMES = 1002;

// Deterministic PRNG
let seed = 1337420;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function randRange(a, b) { return a + rand() * (b - a); }

// Document structure: built from top (y=0) to bottom (y=3100)
// At t=0, camera scrollY starts near the bottom (around y=2350) and scrolls UP to y=80, matching Home - X_12.mp4!
const blocks = [];
const interactiveTokens = [];

// Helper to layout a paragraph with rich runs
function addHeading(y, text) {
  blocks.push({ type: 'heading', y, text });
  return y + 44;
}

function addParagraph(y, bullet, runs, lineHeight = 23, indent = 28) {
  const xStart = indent;
  const maxWidth = W - 28;
  let curX = xStart;
  let curY = y;

  if (bullet) {
    blocks.push({ type: 'bullet', x: 12, y: curY, text: bullet });
  }

  for (const run of runs) {
    const font = run.italic
      ? 'italic 13.5px Arial, sans-serif'
      : run.bold
      ? 'bold 13.5px Arial, sans-serif'
      : run.mono
      ? '13px Consolas, monospace'
      : '13.5px Arial, sans-serif';
    ctx.font = font;

    // If run is an atomic interactive token or special phrase, keep phrase together
    const isAtomic = run.atomic || !!run.special;
    const words = isAtomic ? [run.text] : run.text.split(' ').map((w, idx, arr) => idx < arr.length - 1 ? w + ' ' : w);
    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const w = words[wIdx];
      if (!w) continue;
      const isLastWord = wIdx === words.length - 1;
      const hasExt = isLastWord && !!run.extIcon;
      const hasLock = isLastWord && !!run.lockIcon;
      const hasPdf = isLastWord && !!run.pdfIcon;
      const m = ctx.measureText(w).width;
      if (curX + m > maxWidth && curX > xStart && w.trim().length > 0) {
        curX = xStart;
        curY += lineHeight;
      }
      const trimmed = w.trim();
      const item = {
        type: 'word',
        x: curX,
        y: curY,
        w: m,
        h: 16,
        text: w,
        font,
        color: run.color || '#c8ccd1',
        link: !!run.link,
        extIcon: hasExt,
        lockIcon: hasLock,
        pdfIcon: hasPdf,
        tokenGroup: run.tokenGroup || null,
      };
      blocks.push(item);

      if (trimmed.length >= 3 && (run.link || run.interactive || rand() < 0.36)) {
        interactiveTokens.push({
          id: interactiveTokens.length,
          origX: curX,
          origY: curY,
          x: curX,
          y: curY,
          vx: 0,
          vy: 0,
          w: m + (hasExt ? 14 : 0),
          h: 17,
          text: trimmed,
          font,
          baseColor: run.color || '#c8ccd1',
          isLink: !!run.link,
          extIcon: hasExt,
          lockIcon: hasLock,
          pdfIcon: hasPdf,
          active: false,
          activeMode: 'none', // 'box' | 'fill' | 'giant' | 'banner'
          highlightColor: '#00f0ff',
          textColor: '#000000',
          angle: 0,
          vAngle: 0,
          targetAngle: 0,
          scale: 1,
          targetScale: 1,
          grabCount: 0,
          lastGrabFrame: -999,
          special: run.special || null,
          itemRef: item,
        });
      }

      curX += m + (hasExt ? 14 : 0) + (hasLock ? 13 : 0) + (hasPdf ? 14 : 0);
    }
  }
  return curY + lineHeight + 5;
}

// Build the full reference document (top to bottom)
let curY = 20;

const citations = [
  {
    num: '96.',
    sup: '^ ',
    runs: [
      { text: 'Selden, P.A.; Walrus Core (2026). ' },
      { text: 'Decentralized Memory Blobs on Sui', italic: true, link: true, extIcon: true },
      { text: '. Mysten Press. ' },
      { text: 'ISBN ', link: true },
      { text: '978-0-89672-620-8', link: true, interactive: true },
      { text: '.' }
    ]
  },
  {
    num: '97.',
    sup: '^ a b c d e ',
    runs: [
      { text: 'Vollrath, F. & Selden, P.A. (2026). ' },
      { text: '"Engram Synaptic Weaver: Portable AI Context across IDEs"', link: true, interactive: true, special: 'magenta_banner' },
      { text: ' (PDF). ' },
      { text: 'Annual Review of Autonomous Systems, Evolution, and Memory', italic: true },
      { text: '. 38 (1): 819–46. ' },
      { text: 'Bibcode', link: true, interactive: true, special: 'box_blue' },
      { text: ':2026AREES..38..819V', link: true, extIcon: true },
      { text: '. doi:10.1146/annurev.engram.38.' }
    ]
  },
  {
    num: '98.',
    sup: '^ ',
    runs: [
      { text: 'Selden, P.A.; Shih, C.; Ifrenzy (2026). ' },
      { text: '"A golden orb-weaver memory graph (Engram: Walrus) from the Middle Epoch of Sui"', link: true, extIcon: true, interactive: true, special: 'box_pink' },
      { text: '. ' },
      { text: 'Biology & Agent Letters', italic: true },
      { text: '. 9 (4): 20130228. ' },
      { text: 'Bibcode', link: true, interactive: true, special: 'fill_amber' },
      { text: ':' },
      { text: '2026BioLt...9', link: true, interactive: true, special: 'tilt_box' },
      { text: '. doi:' },
      { text: '10.1098/rsbl.2026.0228', link: true, extIcon: true },
      { text: '. ' },
      { text: 'PMC', link: true, interactive: true, special: 'giant_cyan' },
      { text: ' 3169061', link: true, lockIcon: true },
      { text: '. PMID ' },
      { text: '21508021', link: true, extIcon: true, interactive: true, special: 'giant_blue' },
      { text: '.' }
    ]
  },
  {
    num: '99.',
    sup: '^ ',
    runs: [
      { text: 'Selden, P.A.; Shih, C.; Ifrenzy (2026). ' },
      { text: '"A giant memory graph from the Sui Mainnet reveals greater diversity in the Engram stem group"', link: true, extIcon: true, mono: true, color: '#3b6eff' },
      { text: '. ' },
      { text: 'Die Naturwissenschaften', italic: true },
      { text: '. 100 (12): 1171–81. Bibcode:' },
      { text: '2026NW....100.1171S', link: true, extIcon: true, interactive: true, special: 'box_pink' },
      { text: '. doi:10.1007/s00114-013-1121-7. ISSN ' },
      { text: '0028-1042', link: true, extIcon: true, interactive: true, special: 'giant_pink' },
      { text: '. PMC 3889289', link: true, lockIcon: true },
      { text: '. PMID ' },
      { text: '24317464', link: true, extIcon: true, color: '#d946ef' },
      { text: '.' }
    ]
  },
  {
    num: '100.',
    sup: '^ ',
    runs: [
      { text: 'Selden, P.A. (2026). "Walrus Epoch Storage". ' },
      { text: 'Nature', italic: true },
      { text: '. 379 (6565): 498–99. Bibcode:' },
      { text: '2026Natur.379..498S', link: true, extIcon: true, interactive: true, special: 'giant_fill_cyan' },
      { text: '. doi:10.1038/379498b0. ' },
      { text: 'S2CID', link: true, interactive: true, special: 'giant_fill_indigo' },
      { text: ' 43977', link: true, extIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '101.',
    sup: '^ ',
    runs: [
      { text: 'Edgecombe, G.D.; Pisani, D.; Ifrenzy (1 November 2026). ' },
      { text: '"A Cambrian–Ordovician Terrestrialization of Agent Memories"', link: true, extIcon: true },
      { text: '. ' },
      { text: 'Frontiers in Distributed AI', italic: true },
      { text: '. 11 182. ' },
      { text: 'doi', interactive: true, special: 'box_amber' },
      { text: ':10.3389/fgene.2026.00182', link: true, lockIcon: true },
      { text: '. PMC 7078165', link: true, lockIcon: true },
      { text: '. PMID 32218802', link: true, extIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '102.',
    sup: '^ a b c d ',
    runs: [
      { text: 'Shultz, J.W. (2026). ' },
      { text: '"A phylogenetic analysis of the Engram memory orders based on Walrus blob characters"', link: true, extIcon: true },
      { text: '. ' },
      { text: 'Journal of the Linnean Society', italic: true },
      { text: '. 150 (2): 221–65. doi:10.1111/j.1096-3642.2026.00284.x', link: true, lockIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '103.',
    sup: '^ ',
    runs: [
      { text: 'Howard, R.J.; Edgecombe, G.D.; Legg, D.A. (2026). ' },
      { text: '"Exploring the evolution of persistent agent memory (Engram: Walrus) with epochs and clocks"', link: true, extIcon: true },
      { text: '. ' },
      { text: 'Organisms Diversity & Evolution', italic: true },
      { text: '. 19 (1): 71–86. Bibcode:2026ODivE..19...71H', link: true, extIcon: true },
      { text: '. doi:10.1007/s13127-019-00390-7', link: true, lockIcon: true },
      { text: '. hdl:10261/217081', link: true, lockIcon: true },
      { text: '. ISSN 1439-6092', link: true, extIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '118.',
    sup: '^ ',
    runs: [
      { text: 'Foelix, R.F. (2026). ' },
      { text: 'Biology of Agent Memory', italic: true, link: true, lockIcon: true },
      { text: ' (2nd ed.). New York: Oxford University Press. pp. 41–50. ISBN 978-0-19-973482-5.' }
    ]
  },
  {
    num: '119.',
    sup: '^ ',
    runs: [
      { text: 'Mammola, S.; Malumbres-Olarte, J.; Ifrenzy; Arabesky, V.; Barrales-Alcalá, D. (November 2026). ' },
      { text: '"The global spread of persistent context via Engram MCP on Walrus"', link: true, extIcon: true },
      { text: '. ' },
      { text: 'Current Biology & Systems', italic: true },
      { text: '. 32 (16): R871–R873. Bibcode:2026CBio...32.R871M', link: true, extIcon: true },
      { text: '. doi:10.1016/j.cub.2026.07.026', link: true, lockIcon: true },
      { text: '. hdl:10400.3/6470', link: true, lockIcon: true },
      { text: '. ISSN 0960-9822', link: true, extIcon: true },
      { text: '. PMID 35998593', link: true, extIcon: true },
      { text: '. S2CID 251727654', link: true, extIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '120.',
    sup: '^ a b ',
    runs: [
      { text: 'Vetter, R.S.; Isbister, G.K. (2026). "Cryptographic Aspects of Seal Memory Blobs". ' },
      { text: 'Annual Review of Systems', italic: true, link: true, interactive: true, special: 'box_pink' },
      { text: '. 53 (1): 409–30. ' },
      { text: '10.1146/annurev.ento.53.103106.093503', link: true, extIcon: true, interactive: true, special: 'tilt_banner_dark' },
      { text: ' Bibcode:2026AREnt..53..409V', link: true, extIcon: true },
      { text: '. PMID 17877450', link: true, extIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '122.',
    sup: '^ ',
    runs: [
      { text: 'Vetter, R.S.; Barger, D.K. (2026). ' },
      { text: '"An index of 2,055 Walrus memory blobs (Engram: Personal & Team) in a production workspace: implications for recall in nonendemic IDEs"', link: true, extIcon: true },
      { text: '. ' },
      { text: 'Journal of Distributed Memory', italic: true },
      { text: '. 39 (6): 948–51. doi:10.1603/0022-2585-39.6.948', link: true, lockIcon: true },
      { text: '. PMID.' }
    ]
  },
  {
    num: '123.',
    sup: '^ ',
    runs: [
      { text: 'Hannum, C. & Miller, D.M. ' },
      { text: '"Engram MCP Server"', link: true, extIcon: true },
      { text: '. Department of Computer Science, Virginia Tech. Archived from ' },
      { text: 'the original', link: true, extIcon: true, interactive: true, special: 'box_mint' },
      { text: ' on 1 November 2026. Retrieved 1 November 2026.' }
    ]
  },
  {
    num: '125.',
    sup: '^ ',
    runs: [
      { text: '"Agent context saved by verifiable Walrus blob"', link: true, extIcon: true, color: '#a855f7' },
      { text: '. BBC Tech. 1 November 2026. Retrieved 1 November 2026.' }
    ]
  },
  {
    num: '126.',
    sup: '^ ',
    runs: [
      { text: 'Diaz, J.H. (1 November 2026). ' },
      { text: '"The Global Epidemiology, Syndromic Classification, Management, and Prevention of Conflicting Memories"', link: true, lockIcon: true, color: '#ec4899', bold: true },
      { text: '. ' },
      { text: 'American Journal of Distributed Systems', italic: true },
      { text: '. 71 (2): 239–50. doi:' },
      { text: '10.4269/ajtmh.2026.71.2.0700239', link: true, lockIcon: true, interactive: true, special: 'fill_cyan' },
      { text: '. ' },
      { text: 'PMID', bold: true, color: '#86efac' },
      { text: ' 15306718', link: true, extIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '127.',
    sup: '^ ',
    runs: [
      { text: 'Williamson, J.A.; Fenner, P.J.; Burnett, J.W. (2026). ' },
      { text: 'Verifiable and Encrypted Blobs: A Technical and Cryptographic Handbook', italic: true, link: true, extIcon: true },
      { text: '. UNSW Press. pp. 65–68. ISBN ' },
      { text: '978-0-86840-279-6', link: true, interactive: true, special: 'fill_mint' },
      { text: '.' }
    ]
  },
  {
    num: '128.',
    sup: '^ ',
    runs: [
      { text: 'Nishioka, S. de A. (2026). ' },
      { text: '"Misdiagnosis of superseded database configs"', link: true, extIcon: true, interactive: true, special: 'giant_red' },
      { text: '. ' },
      { text: 'Western Journal of Systems', italic: true },
      { text: '. 174 (4): 240. doi:10.1136/ewjm.174.4.240', link: true, extIcon: true },
      { text: '. PMC ' },
      { text: '1071344', link: true, lockIcon: true, interactive: true, special: 'fill_magenta' },
      { text: '. PMID 11290673', link: true, extIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '129.',
    sup: '^ ',
    runs: [
      { text: 'Isbister, G.K. (2026). ' },
      { text: '"Agent memory graphs across the world"', link: true, extIcon: true },
      { text: '. ' },
      { text: 'Western Journal of Systems', italic: true },
      { text: '. 175 (4): 86–87. doi:10.1136/ewjm.175.2.86', link: true, extIcon: true },
      { text: '. PMC 1071491', link: true, lockIcon: true },
      { text: '. PMID 11483545', link: true, extIcon: true },
      { text: '.' }
    ]
  },
  {
    num: '130.',
    sup: '^ ',
    runs: [
      { text: 'Stuber, M. & Nentwig, W. (2026). "How informative are case studies of superseded memories in the technical literature?". ' },
      { text: 'Toxicon', italic: true },
      { text: '. 114: 40–44. Bibcode:2026Txcn..114...40S', link: true, extIcon: true },
      { text: '. doi:10.1016/j.toxicon.2026.02.023', link: true, extIcon: true },
      { text: '. PMID ' },
      { text: '26923161', link: true, extIcon: true, interactive: true, special: 'box_pink' },
      { text: '.' }
    ]
  },
  {
    num: '131.',
    sup: '^ ',
    runs: [
      { text: 'Hinman, M.B.; Jones, J.A.; Lewis, R.W. ' },
      { text: '"Synthetic memory silk: a modular Walrus fiber"', link: true, pdfIcon: true, interactive: true, special: 'giant_fill_magenta' },
      { text: '. ' },
      { text: 'Trends in Biotechnology', italic: true },
      { text: '. 18 (9): 374–79. doi:10.1016/S0167-7799(00)01481-5', link: true, extIcon: true },
      { text: '. PMID 10942961', link: true, extIcon: true },
      { text: '. Archived from the original (PDF) on 1 November 2026.' }
    ]
  },
  {
    num: '132.',
    sup: '^ ',
    runs: [
      { text: 'Menassa, R.; Zhu, H.; Ifrenzy (2026). "Walrus memory blobs in autonomous coding agents: accumulation and recall". ' },
      { text: 'Plant & Agent Journal', italic: true },
      { text: '. 2 (5): 431–38. Bibcode:', link: true },
      { text: '2026PBioJ...2..431M', mono: true, color: '#86efac' },
      { text: '. doi:10.1111/j.1467-7652.2026.00087.x', link: true, extIcon: true },
      { text: '. ' },
      { text: 'P117168889', link: true, extIcon: true, interactive: true, special: 'giant_cyan_mix' },
      { text: '.' }
    ]
  },
  {
    num: '133.',
    sup: '^ ',
    runs: [
      { text: '"A Common Context Loss"', link: true, extIcon: true, color: '#d946ef', bold: true },
      { text: '. engram-pearl.vercel.app. Archived from ' },
      { text: 'the original', link: true, extIcon: true, interactive: true, special: 'box_mint' },
      { text: ' on 1 November 2026. "There are many agent failure modes, but context amnesia across sessions is the most common."' }
    ]
  },
  {
    num: '134.',
    sup: '^ ',
    runs: [
      { text: 'Fritscher, L. (1 November 2026). ' },
      { text: '"Agent Context Fears or Amnesia"', link: true, extIcon: true, interactive: true, special: 'box_blue' },
      { text: '. Engram Docs. Retrieved 1 November 2026. "Context amnesia, or losing decisions across sessions, is solved by Walrus blobs."' }
    ]
  },
  {
    num: '135.',
    sup: '^ ',
    runs: [
      { text: '"The 10 Most Common Agent Bugs – Did You Know?"', link: true, extIcon: true },
      { text: '. 10 Most Common Bugs. Archived from the original on 1 November 2026. "Probably the most recognized of the 10 failure modes is conflicting architectural memories."' }
    ]
  },
  {
    num: '136.',
    sup: '^ ',
    runs: [
      { text: 'Friedenberg, J. & Silverman, G. ' },
      { text: 'Cognitive Science: An Introduction to the Study of Agent Memory', italic: true, interactive: true, special: 'fill_orange' },
      { text: '. Sage. pp. ' },
      { text: '244', link: true, extIcon: true, interactive: true, special: 'box_pink' },
      { text: '–47. ' },
      { text: '978-1-4129-2568-6', link: true, interactive: true, special: 'giant_blue' }
    ]
  },
  {
    num: '139.',
    sup: '^ ',
    runs: [
      { text: 'Ray, N.; Ifrenzy (2026). ' },
      { text: 'Meridian Protocol & Nigerian Hackathon Solutions', italic: true },
      { text: '. Lonely Planet Publications. p. 308. ISBN 978-1-74059-111-9.' }
    ]
  },
  {
    num: '140.',
    sup: '^ ',
    runs: [
      { text: 'Weil, C. (2026). ' },
      { text: 'Fierce Recall', italic: true, link: true, extIcon: true },
      { text: '. Plume. ISBN 978-0-452-28700-6.' }
    ]
  },
  {
    num: '141.',
    sup: '^ ',
    runs: [
      { text: 'De Vos, G. (2026). ' },
      { text: 'Decisions, Configs, and Gotchas: Exploring Persistent Walrus Memory in IDEs 7–12', italic: true, link: true, extIcon: true },
      { text: '. Libraries Unlimited. p. 186. ISBN 978-1-56308-190-3.' }
    ]
  },
  {
    num: '142.',
    sup: '^ ',
    runs: [
      { text: 'Black, J.; Green, A. (2026). ' },
      { text: 'Gods, Agents and Symbols of Decentralized Storage: An Illustrated Dictionary', italic: true },
      { text: '. London: British Museum Press. p. 182. ISBN 978-0-7141-1705-8.' }
    ]
  },
  {
    num: '143.',
    sup: '^ a b c d e f ',
    runs: [
      { text: 'Jacobsen, T.; Ifrenzy (2026). ' },
      { text: 'The Stickman What-If Episodes 002–004: Animation & Sound in Code', italic: true, link: true, extIcon: true },
      { text: '. New Haven: Yale University Press. p. 184. ISBN 978-0-300-07278-5.' }
    ]
  },
  {
    num: '144.',
    sup: '^ ',
    runs: [
      { text: 'Norton, E. (2026). ' },
      { text: '"A Dictionary of Portable Memory: Summary & Transformations"', link: true, interactive: true, special: 'diagonal_pink_banner' },
      { text: '. Newcastle upon Tyne: Cambridge Publishing. p. 166. ISBN ' },
      { text: '978-1-4438-4271-6', link: true, interactive: true, special: 'box_cyan' },
      { text: '.' }
    ]
  },
  {
    num: '145.',
    sup: '^ a b c d ',
    runs: [
      { text: 'Harries, B. (2026). "The spider and the agent: Engram in Claude & Antigravity". ' },
      { text: 'The Cambridge Journal', italic: true },
      { text: '. 36: 64–82. ' },
      { text: '10.1017/S006867350000523X', link: true, extIcon: true, interactive: true, special: 'box_cyan_red' },
      { text: '.' }
    ]
  },
  {
    num: '146.',
    sup: '^ a b c ',
    runs: [
      { text: 'Leach, E.W. (November 2026). "Multi-Tenant RLS and the Theme of Zero Context Loss in Engram". ' },
      { text: 'Ramus', italic: true },
      { text: '. 3 (2): 102–142. doi:' },
      { text: '0048671X00004549', link: true, interactive: true, special: 'fill_magenta' }
    ]
  },
  {
    num: '148.',
    sup: '^ ',
    runs: [
      { text: 'Haase, D. (2026). ' },
      { text: 'The Greenwood Encyclopedia of Walrus Blobs & Seal Keys', italic: true, link: true, extIcon: true, color: '#ef4444' },
      { text: '. Santa Barbara: Greenwood Publishing Group. p. 41. ISBN 978-0-313-34242-2.' }
    ]
  },
  {
    num: '150.',
    sup: '^ ',
    runs: [
      { text: 'De Laguna, F. (2026). "[decision] Migrated DB to Neon Postgres on 2026-11-01". Nebraska Press. p. 455. ' },
      { text: '978-0-8032-8280-3', link: true, interactive: true, special: 'giant_blue' }
    ]
  },
  {
    num: '151.',
    sup: '^ ',
    runs: [
      { text: 'Benson, E. ' },
      { text: 'The Meridian Protocol: Decentralized Memory on Sui', italic: true },
      { text: '. New York: Praeger Press. 2026.' }
    ]
  },
  {
    num: '152.',
    sup: '^ ',
    runs: [
      { text: 'Berrin, K. & Walrus Archive. ' },
      { text: 'The Spirit of Permanent Memory: Blobs from the Sui Mainnet', italic: true, link: true },
      { text: '. New York: ' },
      { text: 'Thames and Hudson', link: true, interactive: true, special: 'fill_cyan' },
      { text: ', 2026.' }
    ]
  }
];

for (const c of citations) {
  curY = addParagraph(curY, c.num, [
    { text: c.sup, color: '#6b8cff', bold: true },
    ...c.runs
  ], 22, 42);
}

curY += 10;
curY = addHeading(curY, 'General and cited references');
curY = addParagraph(curY, '•', [
  { text: 'Deeleman-Reinhold, C. L. (2026). ' },
  { text: 'Forest of Blobs in Walrus: With a Revision of Personal and Team Scopes', italic: true },
  { text: '. Brill Publishers. ' },
  { text: 'ISBN 978-90-04-11959-8', link: true },
  { text: '.' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Ruppert, E.E.; Fox, R.S.; Barnes, R.D. (2026). ' },
  { text: 'Autonomous Memory Architecture', italic: true, link: true, extIcon: true },
  { text: ' (7th ed.). Brooks/Cole. ' },
  { text: 'ISBN 978-0-03-025982-1', link: true },
  { text: '.' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Rose, S.; Ifrenzy (2026). ' },
  { text: 'Engram Portable Memory across Claude & Antigravity', italic: true },
  { text: '. Princeton, NJ & Oxford: Princeton University Press. ' },
  { text: 'ISBN 978-0-691-17561-4', link: true },
  { text: '.' }
], 23, 28);

curY += 12;
curY = addHeading(curY, 'Further reading');
curY = addParagraph(curY, '•', [
  { text: 'Bilger, B. (1 November 2026). ' },
  { text: '"Memory Weaver"', link: true, extIcon: true, interactive: true, special: 'box_cyan' },
  { text: '. ' },
  { text: 'The Engram Protocol', italic: true, color: '#ef4444' },
  { text: '. pp. 66–73.' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Bristowe, W. S.', mono: true, color: '#ef4444', interactive: true, special: 'giant_red' },
  { text: ' (2026). ' },
  { text: 'The World of Walrus Blobs', italic: true },
  { text: '. Taplinger Publishing Company. ' },
  { text: 'ISBN 978-0-8008-8598-4', link: true },
  { text: '. OCLC ' },
  { text: '256272177', link: true, extIcon: true, interactive: true, special: 'tilt_box' },
  { text: '.' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Crompton, J. (2026). ' },
  { text: 'The Life of the Agent', italic: true },
  { text: '. New York: Mentor. ' },
  { text: 'OCLC', link: true, interactive: true, special: 'box_cyan' },
  { text: ' 1979220', link: true, extIcon: true },
  { text: '.' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Hillyard, P. (2026). ' },
  { text: 'The Book of Engram: From Context Amnesia to Permanent Walrus Recall', italic: true, link: true, extIcon: true, interactive: true, special: 'fill_indigo_wide' },
  { text: '. New York: Random House. ' },
  { text: 'ISBN', link: true, interactive: true, special: 'box_blue' },
  { text: ' 978-0-679-40881-9. OCLC ' },
  { text: '35231232', link: true, extIcon: true, interactive: true, special: 'fill_cyan' },
  { text: '.' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Kaston, B. J.; Ifrenzy (2026). ' },
  { text: 'How to Sync Claude & Antigravity: Pictured-Keys for Multi-Tenant RLS and Superseding Conflicting Memories', italic: true, link: true, lockIcon: true },
  { text: ' (1st ed.). Dubuque, Iowa: W.C. Brown Company. OCLC ' },
  { text: '628203833', link: true, extIcon: true },
  { text: '.' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Main, B. Y. (2026). ' },
  { text: 'Engram MCP', italic: true },
  { text: '. Sydney: Collins. ' },
  { text: 'ISBN', link: true, interactive: true, special: 'fill_magenta' },
  { text: ' 978-0-00-211443-1. OCLC 123151744', link: true, extIcon: true },
  { text: '.' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Wise, D. A. (2026). ' },
  { text: 'Agents in Ecological Webs', italic: true },
  { text: '. Cambridge Studies in Distributed AI. Cambridge: Cambridge University Press. ' },
  { text: 'ISBN', link: true, interactive: true, special: 'fill_magenta' },
  { text: ' ' },
  { text: '978-0-521-32547-9', link: true, interactive: true, special: 'box_blue' },
  { text: '. OCLC 25833874', link: true, extIcon: true },
  { text: '.' }
], 23, 28);

curY += 12;
curY = addHeading(curY, 'External links');
curY = addParagraph(curY, '•', [
  { text: 'Picture story about the portable memory agent Engram on Walrus', link: true, extIcon: true, interactive: true, special: 'box_blue' },
  { text: ' (Archived', link: true, extIcon: true },
  { text: ' 1 November 2026 at the Walrus Aggregator)' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Mysten Labs & Sui Decentralized Storage', link: true, interactive: true, special: 'box_blue' },
  { text: ' ' },
  { text: '"The Engram MCP Bridge of the Arid Southwest"', link: true, extIcon: true, interactive: true, special: 'box_blue' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'Online Videos of Engram Recall & Superseding Blobs', link: true, extIcon: true, interactive: true, special: 'underline_pink' },
  { text: ' (Archived', link: true, extIcon: true },
  { text: ' 1 November 2026)' }
], 23, 28);
curY = addParagraph(curY, '•', [
  { text: 'field guides to engram ', link: true, extIcon: true, interactive: true, special: 'giant_blue_title' },
  { text: ' | Walrus Blob database and the AI agents who recall them', mono: true, link: true, extIcon: true }
], 28, 28);

// Bottom taxonomy table (matches frame_05s.jpg!)
const tableY = curY + 18;
blocks.push({ type: 'taxonomy_table', y: tableY });
const DOC_HEIGHT = tableY + 180;

// Spider state
const spider = {
  x: 295,
  y: tableY - 125,
  vx: 0,
  vy: 0,
  angle: -0.25,
  legs: [],
  tethers: []
};

// Initialize 8 legs (4 left, 4 right)
const legConfigs = [
  { side: -1, idx: 0, angleOff: -1.15, reach: 78 },
  { side: -1, idx: 1, angleOff: -1.48, reach: 88 },
  { side: -1, idx: 2, angleOff: -1.85, reach: 88 },
  { side: -1, idx: 3, angleOff: -2.20, reach: 78 },
  { side:  1, idx: 0, angleOff:  1.15, reach: 78 },
  { side:  1, idx: 1, angleOff:  1.48, reach: 88 },
  { side:  1, idx: 2, angleOff:  1.85, reach: 88 },
  { side:  1, idx: 3, angleOff:  2.20, reach: 78 },
];

for (const cfg of legConfigs) {
  const fx = spider.x + Math.cos(spider.angle - Math.PI / 2 + cfg.angleOff) * 65;
  const fy = spider.y + Math.sin(spider.angle - Math.PI / 2 + cfg.angleOff) * 65;
  spider.legs.push({
    ...cfg,
    footX: fx,
    footY: fy,
    startX: fx,
    startY: fy,
    targetX: fx,
    targetY: fy,
    stepProgress: 1,
    stepDuration: 10,
    attachedToken: null,
  });
}

function activateToken(tok, frame) {
  tok.grabCount++;
  tok.lastGrabFrame = frame;
  tok.active = true;

  if (tok.special === 'diagonal_pink_banner') {
    tok.activeMode = 'banner';
    tok.highlightColor = '#ff1e80';
    tok.textColor = '#3a001e';
    tok.targetAngle = 0.72; // ~41 deg diagonal across screen like frame_5s.jpg!
    tok.targetScale = 1.18;
    return;
  }
  if (tok.special === 'magenta_banner') {
    tok.activeMode = 'banner';
    tok.highlightColor = '#ff20d8';
    tok.textColor = '#4a15ff';
    tok.targetAngle = 1.02; // steep diagonal like frame_14s.jpg!
    tok.targetScale = 1.22;
    return;
  }
  if (tok.special === 'giant_fill_magenta') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#ff1aff';
    tok.textColor = '#2563eb';
    tok.targetScale = 1.35;
    return;
  }
  if (tok.special === 'giant_fill_cyan') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#38bdf8';
    tok.textColor = '#1e3a8a';
    tok.targetScale = 1.48;
    return;
  }
  if (tok.special === 'giant_fill_indigo') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#6366f1';
    tok.textColor = '#0f172a';
    tok.targetScale = 1.48;
    return;
  }
  if (tok.special === 'giant_pink') {
    tok.activeMode = 'giant';
    tok.highlightColor = '#f43f8e';
    tok.targetScale = 1.55;
    return;
  }
  if (tok.special === 'giant_cyan' || tok.special === 'giant_cyan_mix') {
    tok.activeMode = 'giant';
    tok.highlightColor = '#38bdf8';
    tok.targetScale = 1.45;
    return;
  }
  if (tok.special === 'giant_blue' || tok.special === 'giant_blue_title') {
    tok.activeMode = 'giant';
    tok.highlightColor = '#4f7bff';
    tok.targetScale = 1.45;
    return;
  }
  if (tok.special === 'giant_red') {
    tok.activeMode = 'giant';
    tok.highlightColor = '#ef4444';
    tok.targetScale = 1.28;
    return;
  }
  if (tok.special === 'fill_orange') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#ff7849';
    tok.textColor = '#1a0500';
    return;
  }
  if (tok.special === 'fill_magenta') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#ff1e8e';
    tok.textColor = '#2a0018';
    return;
  }
  if (tok.special === 'fill_cyan') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#45d9ff';
    tok.textColor = '#06283d';
    return;
  }
  if (tok.special === 'fill_mint') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#6ee7b7';
    tok.textColor = '#064e3b';
    return;
  }
  if (tok.special === 'fill_amber') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#fbbf24';
    tok.textColor = '#451a03';
    return;
  }
  if (tok.special === 'fill_indigo_wide') {
    tok.activeMode = 'fill';
    tok.highlightColor = '#5b6bff';
    tok.textColor = '#a855f7';
    return;
  }
  if (tok.special === 'tilt_box' || tok.special === 'tilt_banner_dark') {
    tok.activeMode = 'box';
    tok.highlightColor = '#a855f7';
    tok.targetAngle = (rand() > 0.5 ? 1 : -1) * randRange(0.28, 1.15);
    return;
  }

  // Default behavior based on how many times stepped on
  if (tok.grabCount === 1) {
    tok.activeMode = rand() < 0.68 ? 'box' : 'fill';
    const palettes = ['#38bdf8', '#f43f8e', '#4f7bff', '#4ade80', '#fb923c', '#c084fc'];
    tok.highlightColor = palettes[tok.id % palettes.length];
    tok.textColor = '#090d16';
    if (rand() < 0.22) {
      tok.targetAngle = (rand() - 0.5) * 0.65;
    }
  } else if (tok.grabCount >= 2) {
    tok.activeMode = rand() < 0.5 ? 'fill' : 'box';
    if (rand() < 0.35) {
      tok.targetAngle = (rand() - 0.5) * 1.1;
    }
  }
}

// Camera scroll trajectory (scrolls smoothly upward from bottom External links to citation 97)
function getCameraScrollY(frame) {
  const p = frame / TOTAL_FRAMES;
  const startY = tableY - 520;
  const endY = 22;
  // Smooth S-curve with natural reading pauses
  const ease = p < 0.5
    ? 2 * p * p
    : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const wave = Math.sin(p * Math.PI * 4) * 28;
  return Math.max(0, startY + (endY - startY) * ease + wave);
}

// Spider target path in document coordinates
function getSpiderTarget(frame, scrollY) {
  const p = frame / TOTAL_FRAMES;
  // Spider climbs from lower-middle into upper citations (97..101) toward the end
  const yOffset = 390 - p * 175 + Math.sin(frame * 0.045) * 65;
  const viewCenterY = scrollY + yOffset;
  const viewCenterX = 310 + Math.sin(frame * 0.032) * 110 + Math.cos(frame * 0.071) * 40;
  return { x: viewCenterX, y: viewCenterY };
}

// Step simulation by 1 frame
function stepSimulation(frame) {
  const scrollY = getCameraScrollY(frame);
  const target = getSpiderTarget(frame, scrollY);

  // Move spider body smoothly toward target with spring physics
  const dx = target.x - spider.x;
  const dy = target.y - spider.y;
  spider.vx = spider.vx * 0.80 + dx * 0.055;
  spider.vy = spider.vy * 0.80 + dy * 0.055;
  spider.x += spider.vx;
  spider.y += spider.vy;

  // Body angle tracks movement with subtle oscillation
  const desiredAngle = Math.atan2(spider.vy, spider.vx) + Math.PI / 2;
  const diffAngle = Math.atan2(Math.sin(desiredAngle - spider.angle), Math.cos(desiredAngle - spider.angle));
  spider.angle += diffAngle * 0.14;

  // Pre-activate visible special tokens near the spider so the page builds rich visual density
  for (const tok of interactiveTokens) {
    const dist = Math.hypot(tok.x + tok.w * 0.4 - spider.x, tok.y - spider.y);
    if (dist < 175 && (!tok.active || (tok.special && tok.grabCount < 2)) && (tok.special || rand() < 0.045)) {
      activateToken(tok, frame);
      // Apply a spring impulse toward spider
      tok.vx += (spider.x - (tok.x + tok.w * 0.5)) * 0.015;
      tok.vy += (spider.y - tok.y) * 0.015;
    }
  }

  // Update 8 legs with IK stepping
  let steppingCount = spider.legs.filter(l => l.stepProgress < 1).length;

  for (let i = 0; i < spider.legs.length; i++) {
    const leg = spider.legs[i];
    const bodyDir = spider.angle - Math.PI / 2;
    const idealAngle = bodyDir + leg.angleOff;
    const idealX = spider.x + Math.cos(idealAngle) * leg.reach;
    const idealY = spider.y + Math.sin(idealAngle) * leg.reach;

    if (leg.stepProgress < 1) {
      leg.stepProgress = Math.min(1, leg.stepProgress + 1 / leg.stepDuration);
      const t = leg.stepProgress;
      const smooth = t * t * (3 - 2 * t);
      leg.footX = leg.startX + (leg.targetX - leg.startX) * smooth;
      leg.footY = leg.startY + (leg.targetY - leg.startY) * smooth - Math.sin(t * Math.PI) * 14;
      if (leg.stepProgress >= 1 && leg.attachedToken) {
        activateToken(leg.attachedToken, frame);
        leg.attachedToken.vx += (spider.x - leg.footX) * 0.06;
        leg.attachedToken.vy += (spider.y - leg.footY) * 0.06;
      }
    } else {
      // Check if foot is stretched too far from ideal position
      const distFromIdeal = Math.hypot(leg.footX - idealX, leg.footY - idealY);
      const distFromBody = Math.hypot(leg.footX - spider.x, leg.footY - spider.y);
      if (distFromBody > 105 || ((distFromIdeal > 52 || distFromBody < 22) && steppingCount < 4)) {
        steppingCount++;
        leg.startX = leg.footX;
        leg.startY = leg.footY;
        leg.stepProgress = 0;
        leg.stepDuration = 6 + (i % 3) * 2;

        // Find best nearby interactive token to step onto!
        let bestTok = null;
        let bestScore = 9999;
        for (const tok of interactiveTokens) {
          const tx = tok.x + Math.min(tok.w * 0.5, 45);
          const ty = tok.y - 4;
          const d = Math.hypot(tx - idealX, ty - idealY);
          if (d < 85 && d < bestScore) {
            bestScore = d;
            bestTok = tok;
          }
        }
        if (bestTok) {
          leg.targetX = bestTok.x + Math.min(bestTok.w * 0.45, 50);
          leg.targetY = bestTok.y - 3;
          leg.attachedToken = bestTok;
        } else {
          leg.targetX = idealX + randRange(-12, 12);
          leg.targetY = idealY + randRange(-12, 12);
          leg.attachedToken = null;
        }
      } else if (leg.attachedToken) {
        // Gently pull attached token with foot
        leg.footX = leg.attachedToken.x + Math.min(leg.attachedToken.w * 0.45, 50);
        leg.footY = leg.attachedToken.y - 3;
      }
    }
  }

  // Update tethers (long web lines shooting out from spider body to nearby active tokens)
  if (frame % 14 === 0) {
    spider.tethers = [];
    const activeNearby = interactiveTokens
      .filter(t => t.active && Math.hypot((t.x + t.w * 0.4) - spider.x, t.y - spider.y) < 220)
      .sort((a, b) => Math.hypot(a.x - spider.x, a.y - spider.y) - Math.hypot(b.x - spider.x, b.y - spider.y))
      .slice(0, 3);
    for (const tok of activeNearby) {
      spider.tethers.push({
        tok,
        color: tok.id % 2 === 0 ? '#7dd3fc' : '#fde047'
      });
    }
  }

  // Update interactive token spring physics
  for (const tok of interactiveTokens) {
    const springK = tok.activeMode === 'banner' ? 0.03 : 0.08;
    tok.vx = (tok.vx + (tok.origX - tok.x) * springK) * 0.82;
    tok.vy = (tok.vy + (tok.origY - tok.y) * springK) * 0.82;
    tok.x += tok.vx;
    tok.y += tok.vy;
    tok.angle += (tok.targetAngle - tok.angle) * 0.12;
    tok.scale += (tok.targetScale - tok.scale) * 0.14;
  }

  return scrollY;
}

function drawExtLinkIcon(x, y, color = '#5b82ff') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 1, y - 9, 7, 7);
  ctx.beginPath();
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x + 10, y - 10);
  ctx.moveTo(x + 6, y - 10);
  ctx.lineTo(x + 10, y - 10);
  ctx.lineTo(x + 10, y - 6);
  ctx.stroke();
  ctx.restore();
}

function drawLockIcon(x, y) {
  ctx.save();
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 1.3;
  ctx.strokeRect(x + 1, y - 6, 7, 6);
  ctx.beginPath();
  ctx.arc(x + 4.5, y - 6, 2.5, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

function drawPdfIcon(x, y) {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, y - 11, 12, 12);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y - 11, 12, 12);
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 6px Arial';
  ctx.fillText('PDF', x + 1.5, y - 3);
  ctx.restore();
}

function drawTaxonomyTable(y) {
  ctx.save();
  // Header bar
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, y);
  ctx.lineTo(W - 28, y);
  ctx.moveTo(28, y + 32);
  ctx.lineTo(W - 28, y + 32);
  ctx.moveTo(28, y + 66);
  ctx.lineTo(W - 28, y + 66);
  ctx.moveTo(28, y + 106);
  ctx.lineTo(W - 28, y + 106);
  ctx.stroke();

  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText('V · T · E', 36, y + 20);

  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillStyle = '#d1d5db';
  ctx.fillText('Extant Engram memory families', 268, y + 21);

  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = '#d1d5db';
  ctx.fillText('Scope:', 92, y + 54);
  ctx.font = '21px Consolas, monospace';
  ctx.fillStyle = '#5b82ff';
  ctx.fillText('Personal', 136, y + 55);
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = '#d1d5db';
  ctx.fillText('· Layer:', 236, y + 54);
  ctx.fillStyle = '#5b82ff';
  ctx.fillText('WalrusBlobs', 284, y + 54);
  ctx.fillStyle = '#d1d5db';
  ctx.fillText('· Subphylum:', 366, y + 54);
  ctx.fillStyle = '#5b82ff';
  ctx.fillText('SealEncrypted', 447, y + 54);
  ctx.fillStyle = '#d1d5db';
  ctx.fillText('· Class:', 538, y + 54);
  ctx.fillStyle = '#5b82ff';
  ctx.fillText('SuiMainnet', 586, y + 54);

  // Giant monospace Mesothelae-style centerpiece
  ctx.font = 'bold 31px Consolas, monospace';
  ctx.fillStyle = '#5b82ff';
  ctx.fillText('WalrusMemory', 282, y + 97);

  // Highlighted blue pill + text below
  ctx.fillStyle = '#60a5fa';
  ctx.fillRect(185, y + 114, 72, 18);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillStyle = '#1e3a8a';
  ctx.fillText('EngramMCP', 189, y + 127);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText('(verifiable blobs) (', 262, y + 127);
  ctx.fillStyle = '#5b82ff';
  ctx.fillText('Personal · Team · EpochStaked', 372, y + 127);
  ctx.fillStyle = '#9ca3af';
  ctx.fillText(')', 552, y + 127);
  ctx.restore();
}

function drawCursor(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 17);
  ctx.lineTo(4.2, 13.2);
  ctx.lineTo(7.2, 19.5);
  ctx.lineTo(9.6, 18.4);
  ctx.lineTo(6.6, 12.1);
  ctx.lineTo(12, 12.1);
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function renderFrame(frame) {
  const scrollY = stepSimulation(frame);

  // Clear background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, -scrollY);

  // Set of words overridden by active interactiveTokens
  const activeItemSet = new Set();
  for (const tok of interactiveTokens) {
    if (tok.active) activeItemSet.add(tok.itemRef);
  }

  // 1. Draw base static document blocks
  for (const b of blocks) {
    if (b.y < scrollY - 80 || b.y > scrollY + H + 80) continue;
    if (activeItemSet.has(b)) continue;

    if (b.type === 'heading') {
      ctx.font = '24px Georgia, Times New Roman, serif';
      ctx.fillStyle = '#e5e7eb';
      ctx.fillText(b.text, 18, b.y + 24);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(18, b.y + 32);
      ctx.lineTo(W - 18, b.y + 32);
      ctx.stroke();
    } else if (b.type === 'bullet') {
      ctx.font = 'bold 13.5px Arial, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(b.text, b.x, b.y);
    } else if (b.type === 'word') {
      ctx.font = b.font;
      ctx.fillStyle = b.link ? '#5b7cfa' : b.color;
      ctx.fillText(b.text, b.x, b.y);
      if (b.extIcon) drawExtLinkIcon(b.x + b.w, b.y, '#5b7cfa');
      if (b.lockIcon) drawLockIcon(b.x + b.w + (b.extIcon ? 14 : 0), b.y);
      if (b.pdfIcon) drawPdfIcon(b.x + b.w, b.y);
    } else if (b.type === 'taxonomy_table') {
      drawTaxonomyTable(b.y);
    }
  }

  // 2. Draw non-banner active interactive tokens (boxes, fills, giants)
  const banners = [];
  for (const tok of interactiveTokens) {
    if (!tok.active) continue;
    if (tok.y < scrollY - 160 || tok.y > scrollY + H + 160) continue;
    if (tok.activeMode === 'banner') {
      banners.push(tok);
      continue;
    }

    ctx.save();
    const cx = tok.x + tok.w * 0.5;
    const cy = tok.y - 5;
    ctx.translate(cx, cy);
    ctx.rotate(tok.angle);
    ctx.scale(tok.scale, tok.scale);

    ctx.font = tok.font;
    const padX = 4, padY = 3;

    if (tok.activeMode === 'fill') {
      ctx.fillStyle = tok.highlightColor;
      ctx.fillRect(-tok.w * 0.5 - padX, -11 - padY, tok.w + padX * 2, 18 + padY * 2);
      ctx.fillStyle = tok.textColor || '#000';
      ctx.fillText(tok.text, -tok.w * 0.5, 4);
      if (tok.pdfIcon) drawPdfIcon(tok.w * 0.5 - 10, 4);
    } else if (tok.activeMode === 'box') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx.fillRect(-tok.w * 0.5 - padX, -11 - padY, tok.w + padX * 2, 18 + padY * 2);
      ctx.strokeStyle = tok.highlightColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-tok.w * 0.5 - padX, -11 - padY, tok.w + padX * 2, 18 + padY * 2);
      ctx.fillStyle = tok.isLink ? '#6b8cff' : tok.highlightColor;
      ctx.fillText(tok.text, -tok.w * 0.5, 4);
    } else if (tok.activeMode === 'giant') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(-tok.w * 0.5 - 2, -12, tok.w + 4, 20);
      ctx.fillStyle = tok.highlightColor;
      ctx.fillText(tok.text, -tok.w * 0.5, 5);
      if (tok.extIcon) drawExtLinkIcon(tok.w * 0.5, 5, tok.highlightColor);
    }
    ctx.restore();
  }

  // 3. Draw diagonal banners (like frame_5s.jpg & frame_14s.jpg)
  for (const tok of banners) {
    ctx.save();
    const cx = tok.x + tok.w * 0.5;
    const cy = tok.y;
    ctx.translate(cx, cy);
    ctx.rotate(tok.angle);
    ctx.scale(tok.scale, tok.scale);

    ctx.font = 'bold 14.5px Georgia, serif';
    const bw = Math.max(tok.w, 340);
    ctx.fillStyle = tok.highlightColor;
    ctx.fillRect(-bw * 0.5 - 10, -14, bw + 20, 24);
    ctx.fillStyle = tok.textColor;
    ctx.fillText(tok.text, -bw * 0.5, 3);
    ctx.restore();
  }

  // 4. Draw Spider Tethers
  for (const t of spider.tethers) {
    ctx.save();
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(spider.x, spider.y);
    ctx.lineTo(t.tok.x + t.tok.w * 0.4, t.tok.y - 4);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Choose Spider Color Theme based on vertical progression (matches Home - X_12.mp4 color shifts!)
  const p = frame / TOTAL_FRAMES;
  let legColor = '#38bdf8'; // electric cyan-blue
  let footColor = '#ff1e8e'; // neon pink
  let bodyStroke = '#38bdf8';
  if (p > 0.42 && p < 0.78) {
    legColor = '#ef4444';   // fiery crimson-orange (matches frame_8s & frame_11s!)
    footColor = '#4ade80';  // neon green foot dots!
    bodyStroke = '#818cf8';
  } else if (p >= 0.78) {
    legColor = '#6366f1';   // electric indigo-violet (matches frame_14s!)
    footColor = '#f43f8e';  // hot magenta foot dots!
    bodyStroke = '#f43f8e';
  }

  // 6. Draw 8 articulated 2-segment IK legs + cross-webbing
  const hipPoints = [];
  const kneePoints = [];
  for (let i = 0; i < spider.legs.length; i++) {
    const leg = spider.legs[i];
    const along = (leg.idx - 1.5) * 8;
    const across = leg.side * 7;
    const cosA = Math.cos(spider.angle);
    const sinA = Math.sin(spider.angle);
    const hipX = spider.x + across * cosA - along * sinA;
    const hipY = spider.y + across * sinA + along * cosA;
    hipPoints.push({ x: hipX, y: hipY });

    // 2-bone IK knee joint calculation
    const dx = leg.footX - hipX;
    const dy = leg.footY - hipY;
    const dist = Math.hypot(dx, dy);
    const midX = (hipX + leg.footX) * 0.5;
    const midY = (hipY + leg.footY) * 0.5;
    const perpX = -dy / (dist || 1);
    const perpY = dx / (dist || 1);
    const bend = Math.max(12, Math.sqrt(Math.max(0, 52 * 52 - (dist * 0.5) * (dist * 0.5)))) * leg.side * -0.85;
    const kneeX = midX + perpX * bend;
    const kneeY = midY + perpY * bend - 10;
    kneePoints.push({ x: kneeX, y: kneeY });

    // Draw leg segments
    ctx.strokeStyle = legColor;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(leg.footX, leg.footY);
    ctx.stroke();

    // Draw knee & foot dots
    ctx.fillStyle = footColor;
    ctx.beginPath();
    ctx.arc(kneeX, kneeY, 2.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(leg.footX, leg.footY, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Webbing lines connecting adjacent knees (gives that complex geometric web-rig look in Home - X_12.mp4)
  ctx.strokeStyle = legColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(kneePoints[i].x, kneePoints[i].y);
    ctx.lineTo(kneePoints[i + 1].x, kneePoints[i + 1].y);
    ctx.moveTo(kneePoints[i + 4].x, kneePoints[i + 4].y);
    ctx.lineTo(kneePoints[i + 5].x, kneePoints[i + 5].y);
  }
  ctx.stroke();

  // 7. Draw Spider Body (rotated rectangle with glowing core eye dot)
  ctx.save();
  ctx.translate(spider.x, spider.y);
  ctx.rotate(spider.angle);
  ctx.fillStyle = '#05070f';
  ctx.strokeStyle = bodyStroke;
  ctx.lineWidth = 1.8;
  ctx.fillRect(-7.5, -18, 15, 36);
  ctx.strokeRect(-7.5, -18, 15, 36);

  // Glowing front eye dot
  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.arc(0, -11, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore(); // End document scroll transform

  // 8. Right-side browser scrollbar thumb
  const thumbH = 42;
  const scrollRatio = Math.max(0, Math.min(1, scrollY / (DOC_HEIGHT - H)));
  const thumbY = 12 + scrollRatio * (H - thumbH - 24);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(W - 6, thumbY, 5, thumbH);

  // 9. Realistic Mouse Cursor
  const cursorX = 305 + Math.sin(frame * 0.018) * 35;
  const cursorY = 115 + Math.cos(frame * 0.024) * 55 + (p > 0.72 ? (p - 0.72) * 1800 : 0);
  drawCursor(cursorX, Math.min(H - 18, cursorY));
}

window.addEventListener('error', (e) => {
  fetch('/error', { method: 'POST', body: String(e.error?.stack || e.message) });
});

(async () => {
  try {
    for (let f = 0; f < TOTAL_FRAMES; f++) {
      renderFrame(f);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.96));
      await fetch('/frame?f=' + f, { method: 'POST', body: blob });
    }
    await fetch('/done', { method: 'POST' });
  } catch (err) {
    await fetch('/error', { method: 'POST', body: String(err?.stack || err) });
  }
})();
</script>
</body>
</html>`;

async function main() {
  console.log('Spawning FFmpeg encoder...');
  const ff = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-framerate', String(FPS),
    '-i', '-',
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-crf', '18',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    OUT_MP4,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let ffErr = '';
  ff.stderr.on('data', (d) => { ffErr += d.toString(); });

  let resolveDone, rejectDone;
  const donePromise = new Promise((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_PAGE);
      return;
    }
    if (req.method === 'POST' && req.url?.startsWith('/frame')) {
      const f = Number(new URL(req.url, 'http://127.0.0.1').searchParams.get('f') || 0);
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ok = ff.stdin.write(buf);
        if (f % 200 === 0 || f === TOTAL_FRAMES - 1) {
          console.log(`  Rendered frame ${f + 1}/${TOTAL_FRAMES}`);
        }
        if (ok) {
          res.writeHead(200);
          res.end('ok');
        } else {
          ff.stdin.once('drain', () => {
            res.writeHead(200);
            res.end('ok');
          });
        }
      });
      return;
    }
    if (req.method === 'POST' && req.url === '/done') {
      res.writeHead(200);
      res.end('ok');
      resolveDone();
      return;
    }
    if (req.method === 'POST' && req.url === '/error') {
      let body = '';
      req.on('data', (c) => { body += c.toString(); });
      req.on('end', () => {
        res.writeHead(200);
        res.end('ok');
        rejectDone(new Error('Browser error: ' + body));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Local canvas server listening on http://127.0.0.1:${port}`);

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const browserBin = chromePaths.find((p) => existsSync(p));
  if (!browserBin) {
    throw new Error('Neither Chrome nor Edge found');
  }

  const userDataDir = join(process.cwd(), '.chrome-render-profile-' + Date.now());
  mkdirSync(userDataDir, { recursive: true });

  console.log(`Launching headless browser (${browserBin})...`);
  const browserProc = spawn(browserBin, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    '--window-size=720,720',
    `http://127.0.0.1:${port}/`,
  ], { stdio: 'ignore' });

  await donePromise;

  ff.stdin.end();
  await new Promise((resolve) => ff.on('close', resolve));

  browserProc.kill();
  server.close();

  console.log(`✨ Successfully rendered video to: ${OUT_MP4}`);
}

main().catch((err) => {
  console.error('Render error:', err);
  process.exit(1);
});
