(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('evidence').textContent);
  const milestones = data.milestones;
  const $ = id => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const domains = [
    { id:'codex', name:'Legacy Codex', role:'THE HUMAN FRONT DOOR', x:480, y:326, color:'#81d5cf', description:'The central thread: make intent representable, actionable, and resumable. These chapters trace the human-facing Codex, not a claim that every surrounding project is one deployed runtime.' },
    { id:'doctrine', name:'Doctrine', role:'MEANING THAT SURVIVES', x:317, y:148, color:'#dfbd85', description:'Frameworks, architecture documents, and the Goose Cookbook preserve the meaning behind the machinery. A documented principle is not evidence that every runtime follows it.' },
    { id:'agents', name:'Agent practice', role:'BUILDERS & INSTRUCTIONS', x:621, y:125, color:'#a6adf5', description:'Builder instructions and agent-oriented work appear here when the selected sources record them. This is a history of the practice, not evidence of an always-on autonomous agent mesh.' },
    { id:'foundry', name:'Foundry', role:'THE EXECUTION LAYER', x:782, y:257, color:'#a6adf5', description:'The builder-facing side of the ecosystem. The historical record distinguishes execution machinery from the human-facing Codex, even where their ideas rhyme.' },
    { id:'control', name:'Control Panel', role:'ROUTING & GOVERNANCE', x:765, y:451, color:'#81d5cf', description:'The control and coordination strand. Follow the sources for its historical routing and governance roles; they do not by themselves prove current deployment or shared database ownership.' },
    { id:'evidence', name:'Evidence', role:'CLAIMS MEET REALITY', x:580, y:555, color:'#81d5cf', description:'The distinction between something being written, built, verified, and live becomes explicit structure. Evidence is not a model declaring itself correct.' },
    { id:'missions', name:'Mission Loop', role:'INTENT → NEXT MOVE', x:345, y:550, color:'#a6adf5', description:'Missions, finish lines, next moves, and resumption give intention an operational shape. A recommendation and a committed action remain different things.' },
    { id:'reasoning', name:'Reasoning', role:'RECONSTRUCT & CORRECT', x:193, y:397, color:'#a6adf5', description:'The predictive and reconstructive strand: infer a useful move from available context, retain uncertainty, and let human correction matter. No claim of sentience or autonomous self-verification.' },
    { id:'neuro', name:'Neuro / capacity', role:'THE HUMAN CONSTRAINT', x:136, y:227, color:'#dfbd85', description:'Capacity and neuro-related experiments belong to the wider story. Their presence is not evidence of a live biometric feed into Codex.' },
    { id:'artful', name:'Artful Intelligence', role:'THE WIDER CONSTELLATION', x:443, y:38, color:'#dfbd85', description:'A wider expression of the ecosystem. The timeline shows source-backed appearances, not a retroactive claim that all projects shared one runtime from the beginning.' },
  ];
  const domainById = Object.fromEntries(domains.map(d => [d.id,d]));
  const kindLabels = { documented:'DOCUMENTED INTENT', implemented:'IMPLEMENTED · NOT LIVE PROOF', branch:'BRANCH WORK · NOT LIVE PROOF' };
  let index = parseChapter(location.hash, milestones);
  let playing = false;
  let timer = null;
  let motion = !reducedMotion.matches;
  let modalMode = 'archive';
  let filter = '';
  let toastTimer;
  let animationFrame = null;
  let lastFrame = 0;

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG, tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }
  function dateLabel(date, short = false) {
    return new Intl.DateTimeFormat('en-US', { month:short ? 'short' : 'long', day:'numeric', year:'numeric', timeZone:'UTC' }).format(new Date(`${date}T12:00:00Z`));
  }
  function sourceLink(source, n) {
    const link = make('a','source-link');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(make('span','source-mark',String(n + 1).padStart(2,'0')));
    const copy = make('span','source-title',source.label);
    let hint = source.path || new URL(source.url).pathname.replace(/^\//,'');
    if (source.revision) hint = `${source.revision.slice(0,7)} · ${hint}`;
    copy.append(make('small','',hint));
    link.append(copy,make('span','source-arrow','↗'));
    return link;
  }
  function announce(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
  }
  function setPlaying(value) {
    playing = value;
    clearInterval(timer);
    timer = null;
    $('play').textContent = value ? 'Ⅱ' : '▶';
    $('play').setAttribute('aria-label', value ? 'Pause history' : 'Play history');
    $('play').setAttribute('aria-pressed',String(value));
    if (value) timer = setInterval(() => {
      const next = nextIndex(index, milestones.length);
      if (next.ended) setPlaying(false);
      else showChapter(next.index, { fromPlayback:true });
    }, 6500);
  }
  function showChapter(value, { fromPlayback = false, writeHash = true, scrollRail = true } = {}) {
    index = clampIndex(value, milestones.length);
    if (!fromPlayback) setPlaying(false);
    const chapter = milestones[index];
    const available = new Set(visibleDomains(milestones,index));
    const current = new Set(chapter.domains);
    $('timeline').value = String(index);
    $('timeline').style.setProperty('--progress', `${index / Math.max(1,milestones.length - 1) * 100}%`);
    $('timeline').setAttribute('aria-valuetext', `${dateLabel(chapter.date)}: ${chapter.title}`);
    $('chapter-counter').textContent = `${String(index + 1).padStart(2,'0')} / ${String(milestones.length).padStart(2,'0')}`;
    $('previous').disabled = index === 0;
    $('next').disabled = index === milestones.length - 1;
    $('scene-date').textContent = dateLabel(chapter.date).toUpperCase();
    $('chapter-era').textContent = chapter.era;
    $('chapter-kind').textContent = kindLabels[chapter.kind];
    $('chapter-kind').dataset.kind = chapter.kind;
    $('chapter-title').textContent = chapter.title;
    $('chapter-summary').textContent = chapter.summary;
    $('chapter-meaning').textContent = chapter.meaning;
    $('chapter-date').textContent = `${dateLabel(chapter.date)} · Source-backed milestone; not a deployment timestamp.`;
    $('chapter-sources').replaceChildren(...chapter.sources.map(sourceLink));
    $('chapter-unknowns').replaceChildren();
    if (chapter.unknowns?.length) {
      const list = make('ul');
      for (const unknown of chapter.unknowns) list.append(make('li','',unknown));
      $('chapter-unknowns').append(make('strong','','What this does not establish'),list);
    }
    $('chapter-domains').replaceChildren(...chapter.domains.map(id => {
      const button = make('button','domain-tag',domainById[id].name);
      button.addEventListener('click',() => openDomain(id));
      return button;
    }));
    $('mobile-domains').replaceChildren(...domains.filter(d => available.has(d.id)).map(d => {
      const button = make('button','domain-tag',d.name);
      button.addEventListener('click',() => openDomain(d.id));
      return button;
    }));
    let count = 0;
    for (const domain of domains) {
      const node = $(`node-${domain.id}`);
      const visible = available.has(domain.id);
      if (visible) count++;
      node.classList.toggle('visible',visible);
      node.classList.toggle('current',current.has(domain.id));
      node.setAttribute('tabindex',visible ? '0' : '-1');
      node.setAttribute('aria-hidden',String(!visible));
      node.style.pointerEvents = visible ? '' : 'none';
      const connection = $(`edge-${domain.id}`);
      if (connection) {
        connection.classList.toggle('active',visible && available.has('codex'));
        connection.classList.toggle('current',visible && current.has(domain.id));
      }
    }
    $('domain-count').textContent = `${count} / ${domains.length} DOMAINS`;
    for (const [i,button] of [...$('chapter-rail').children].entries()) {
      button.setAttribute('aria-current',String(i === index));
    }
    if (scrollRail) {
      const selected = $('chapter-rail').children[index];
      const rail = $('chapter-rail');
      rail.scrollTo({ left:Math.max(0, selected.offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + selected.clientWidth / 2), behavior:motion ? 'smooth' : 'instant' });
    }
    if (writeHash) {
      const hash = `#chapter=${encodeURIComponent(chapter.id)}`;
      try { history.replaceState(null,'',hash); } catch { /* Sandboxed file viewers may refuse history mutation. */ }
    }
    $('chapter-announcement').textContent = `Chapter ${index + 1}. ${chapter.title}. ${dateLabel(chapter.date)}.`;
  }

  function buildScene() {
    const dust = $('epoch-dust');
    // Fixed decorative geometry. These are not events, metrics, or activity indicators.
    for (let i = 0; i < 90; i++) {
      const angle = i * 2.399963;
      const radius = 140 + (i * 41 % 190);
      dust.append(svg('circle',{cx:480 + Math.cos(angle) * radius,cy:326 + Math.sin(angle) * radius * .78,r:i % 9 === 0 ? 1.6 : .65,fill:i % 3 ? '#96bad2' : '#dfbd85',opacity:i % 4 ? .22 : .5}));
    }
    for (const domain of domains) {
      const {id,x,y,color} = domain;
      if (id !== 'codex') {
        const path = svg('path',{id:`edge-${id}`,class:'connection',d:`M480 326 Q${480 + (x - 480) * .28 - (y - 326) * .13} ${326 + (y - 326) * .72 + (x - 480) * .13} ${x} ${y}`});
        $('connections').append(path);
      }
      const node = svg('g',{id:`node-${id}`,class:'node',role:'button',tabindex:'0','aria-label':`Explore ${domain.name} history`,style:`--node-color:${color}`});
      const title = svg('title'); title.textContent = domain.name; node.append(title);
      if (id === 'codex') {
        node.append(svg('circle',{cx:x,cy:y,r:91,class:'node-halo'}));
        node.append(svg('circle',{cx:x,cy:y,r:76,fill:'url(#core)',stroke:'#81d5cf', 'stroke-opacity':'.3','stroke-width':'.6'}));
        const lines = svg('g',{class:'core-shape','aria-hidden':'true'});
        for (let i = 0; i < 15; i++) lines.append(svg('ellipse',{cx:x,cy:y,rx:38 + i * 2.6,ry:68 - i * 1.3,transform:`rotate(${i * 12} ${x} ${y})`,class:'core-orbit'}));
        const inner = svg('g',{class:'core-shape reverse','aria-hidden':'true'});
        for (let i = 0; i < 7; i++) inner.append(svg('ellipse',{cx:x,cy:y,rx:71,ry:22 + i * 6,transform:`rotate(${i * 25} ${x} ${y})`,class:'core-orbit violet'}));
        node.append(lines,inner,svg('circle',{cx:x,cy:y,r:50,fill:'#0b1929','fill-opacity':'.7'}));
        for (const [text,dy] of [['LEGACY',-7],['CODEX',18]]) {
          const label = svg('text',{x:x + 3,y:y + dy,'text-anchor':'middle',class:'core-label'});label.textContent = text;node.append(label);
        }
        const caption = svg('text',{x,y:y + 43,'text-anchor':'middle',class:'core-caption'});caption.textContent = 'THE THREAD';node.append(caption);
      } else {
        node.append(svg('circle',{cx:x,cy:y,r:31,class:'node-halo'}));
        node.append(svg('circle',{cx:x,cy:y,r:15,class:'node-ring'}));
        node.append(svg('circle',{cx:x,cy:y,r:3.3,class:'node-point'}));
        const name = svg('text',{x,y:y + 38,'text-anchor':'middle',class:'node-name'});name.textContent = domain.name;
        const role = svg('text',{x,y:y + 55,'text-anchor':'middle',class:'node-role'});role.textContent = domain.role;
        node.append(name,role);
      }
      node.addEventListener('click',() => openDomain(id));
      node.addEventListener('keydown',event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault();openDomain(id); }
      });
      $('domain-nodes').append(node);
    }
  }

  function openDialog() {
    setPlaying(false);
    if (!$('inspector').open) $('inspector').showModal();
  }
  function openDomain(id) {
    modalMode = 'domain';
    filter = id;
    $('inspector-eyebrow').textContent = 'A STRAND OF THE SAME IDEA';
    $('inspector-title').textContent = domainById[id].name;
    $('inspector-description').textContent = domainById[id].description;
    $('search-wrap').hidden = true;
    // Domain exploration is deliberately full-history, even while a past frame is selected.
    const note = make('p','','Full-history index. Choosing a chapter moves the timeline to that point.');
    $('inspector-content').replaceChildren(note,...findMilestones(milestones,'',id).map(archiveItem));
    openDialog();
  }
  function archiveItem(chapter) {
    const item = make('button','archive-item');
    item.append(make('small','',`${dateLabel(chapter.date,true)} · ${kindLabels[chapter.kind]}`),make('h3','',chapter.title),make('p','',chapter.summary));
    item.addEventListener('click',() => {
      showChapter(milestones.indexOf(chapter));
      $('inspector').close();
      $('transport').scrollIntoView({behavior:motion ? 'smooth' : 'instant',block:'start'});
      $('timeline').focus({preventScroll:true});
    });
    return item;
  }
  function renderArchive() {
    const matches = findMilestones(milestones,$('archive-search').value,filter);
    $('inspector-content').replaceChildren(...matches.map(archiveItem));
    if (!matches.length) $('inspector-content').append(make('p','no-results','No recorded chapters match. Try another term or choose All strands.'));
    $('archive-filters').replaceChildren(...[{id:'',name:'All strands'},...domains].map(d => {
      const button = make('button','domain-tag',d.name);
      button.setAttribute('aria-pressed',String(d.id === filter));
      button.addEventListener('click',() => {filter = d.id;renderArchive();});
      return button;
    }));
  }
  function openArchive() {
    modalMode = 'archive';filter = '';
    $('inspector-eyebrow').textContent = `${milestones.length} SOURCE-BACKED CHAPTERS`;
    $('inspector-title').textContent = 'Follow a thread.';
    $('inspector-description').textContent = 'Search the turning points, or isolate one strand of the ecosystem. This is a curated history—not every commit and not a complete archive of the original conversations.';
    $('search-wrap').hidden = false;
    $('archive-search').value = '';
    renderArchive();openDialog();
    $('archive-search').focus();
  }
  function openAbout() {
    modalMode = 'about';
    $('inspector-eyebrow').textContent = 'PROVENANCE / NOT MYTHOLOGY';
    $('inspector-title').textContent = 'Beautiful. And accountable.';
    $('inspector-description').textContent = data.coverage.summary;
    $('search-wrap').hidden = true;
    const content = $('inspector-content');content.replaceChildren();
    const explain = make('section','about-block');
    explain.append(make('h3','','How to read this atlas'),make('p','','Move chapter by chapter with the timeline, arrow buttons, or Left/Right keys when a text field or dialog is not active. The graph shows conceptual domains documented by that point. Its orbital positions are editorial, not measurements. Chapters are spaced equally, not by elapsed time. Ambient motion never indicates actual work or live system activity.'),make('p','','Documented intent means a source records a principle or historical account. Implemented means source code or a commit establishes a change—not that it shipped successfully. Branch work is marked separately. Sources open on GitHub; private sources may require your account.'));
    const limits = make('section','about-block');limits.append(make('h3','','Coverage & unknowns'));
    const list = make('ul');for (const line of data.coverage.limits) list.append(make('li','',line));limits.append(list);
    const sources = make('section','about-block');sources.append(make('h3','','The inspected repositories'));
    for (const repo of data.repositories) {
      const p = make('p');const a = make('a','',repo.name);a.href = repo.url;a.target = '_blank';a.rel = 'noopener noreferrer';
      p.append(a,document.createTextNode(` — ${repo.role}${repo.revision ? ` · ${repo.revision.slice(0,7)}` : ''}`));sources.append(p);
    }
    const method = make('section','about-block');method.append(make('h3','','An offline artifact, not another service'),make('p','',`Snapshot ${data.asOf}. No analytics, API keys, live account queries, or production writes. The original vision did not need to become more ambitious for the build to reveal it. The closing quote comes from the canonical Goose Cookbook; the narrative around it is an editorial synthesis.`));
    content.append(explain,limits,sources,method);openDialog();
  }

  const sky = $('sky');
  const context = sky.getContext('2d');
  let width = 1, height = 1, stars = [];
  function resizeSky() {
    width = innerWidth;height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1,2);
    sky.width = Math.round(width * ratio);sky.height = Math.round(height * ratio);
    if (!context) return;
    context.setTransform(ratio,0,0,ratio,0,0);
    stars = Array.from({length:Math.min(140,Math.floor(width * height / 9500))},(_,i) => ({x:((i * 193.37 + 17) % 997)/997 * width,y:((i * 389.17 + 41) % 991)/991 * height,r:i % 11 === 0 ? 1.15 : .5,phase:i * .73}));
    drawSky(0);
  }
  function drawSky(time) {
    if (!context) return;
    context.clearRect(0,0,width,height);
    for (const star of stars) {
      const alpha = motion ? .13 + (Math.sin(time / 4500 + star.phase) + 1) * .13 : .25;
      context.fillStyle = `rgba(166,190,215,${alpha})`;
      context.beginPath();context.arc(star.x,star.y,star.r,0,Math.PI * 2);context.fill();
    }
  }
  function animate(time) {
    if (!motion || document.hidden) {animationFrame = null;return;}
    if (time - lastFrame > 50) {drawSky(time);lastFrame = time;}
    animationFrame = requestAnimationFrame(animate);
  }
  function updateMotion() {
    document.documentElement.classList.toggle('is-static',!motion);
    $('motion-button').setAttribute('aria-pressed',String(motion));
    $('motion-button').textContent = `Motion ${motion ? 'on' : 'off'} ∿`;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    drawSky(0);
    if (motion && !document.hidden) animationFrame = requestAnimationFrame(animate);
  }

  buildScene();
  $('timeline').max = String(milestones.length - 1);
  $('first-date').textContent = dateLabel(milestones[0].date,true).toUpperCase();
  $('last-date').textContent = dateLabel(milestones.at(-1).date,true).toUpperCase();
  $('snapshot-label').textContent = `SNAPSHOT / ${data.asOf}`;
  for (const [i,chapter] of milestones.entries()) {
    const button = make('button','chapter-button');
    button.append(make('span','',`${String(i + 1).padStart(2,'0')} / ${dateLabel(chapter.date,true).toUpperCase()}`),document.createTextNode(chapter.title));
    button.addEventListener('click',() => showChapter(i));
    $('chapter-rail').append(button);
  }
  $('timeline').addEventListener('input',event => showChapter(event.target.value));
  $('previous').addEventListener('click',() => showChapter(index - 1));
  $('next').addEventListener('click',() => showChapter(index + 1));
  $('latest').addEventListener('click',() => showChapter(milestones.length - 1));
  document.querySelector('.brand').addEventListener('click',event => {event.preventDefault();showChapter(milestones.length - 1);window.scrollTo({top:0,behavior:motion ? 'smooth' : 'instant'});});
  $('play').addEventListener('click',() => {
    if (playing) setPlaying(false);
    else {if (index === milestones.length - 1) showChapter(0);setPlaying(true);}
  });
  $('begin').addEventListener('click',() => {showChapter(0);setPlaying(true);});
  $('motion-button').addEventListener('click',() => {motion = !motion;updateMotion();});
  reducedMotion.addEventListener('change',event => {motion = !event.matches;updateMotion();});
  $('archive-button').addEventListener('click',openArchive);
  $('about-button').addEventListener('click',openAbout);
  $('coverage-button').addEventListener('click',openAbout);
  $('close-dialog').addEventListener('click',() => $('inspector').close());
  $('inspector').addEventListener('click',event => {if (event.target === $('inspector')) {const r = $('inspector').getBoundingClientRect();if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('inspector').close();}});
  $('archive-search').addEventListener('input',() => {if (modalMode === 'archive') renderArchive();});
  $('copy-link').addEventListener('click',async () => {
    try {await navigator.clipboard.writeText(location.href);announce('Chapter link copied. Local links work on this computer.');}
    catch {announce('Copy the chapter link from your browser’s address bar.');}
  });
  addEventListener('hashchange',() => showChapter(parseChapter(location.hash,milestones),{writeHash:false}));
  addEventListener('keydown',event => {
    if ($('inspector').open || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault();showChapter(index + (event.key === 'ArrowRight' ? 1 : -1));}
  });
  document.addEventListener('visibilitychange',() => {if (document.hidden) setPlaying(false);updateMotion();});
  addEventListener('resize',resizeSky);
  resizeSky();updateMotion();showChapter(index,{scrollRail:false});
})();
