/**
 * Stika "Try It Yourself" Demo
 * 3-step wizard: Design Campaign → Preview Dashboard → Submit Campaign
 */
const StikaDemo = (() => {
  // ── State ──────────────────────────────────────────────────────────
  const API_BASE = 'https://bold.stika.ng/api/v1/agencies';

  const LOCATIONS = [
    { name: 'Kaduna Central', lat: 10.5105, lng: 7.4165, city: 'Kaduna' },
    { name: 'Rigasa, Kaduna',  lat: 10.5410, lng: 7.3750, city: 'Kaduna' },
    { name: 'Zaria',           lat: 11.0801, lng: 7.7069, city: 'Zaria' },
    { name: 'Barnawa, Kaduna', lat: 10.4833, lng: 7.4333, city: 'Kaduna' },
    { name: 'Kano City',       lat: 12.0022, lng: 8.5920, city: 'Kano' },
    { name: 'Sabon Gari, Kano',lat: 11.9700, lng: 8.5300, city: 'Kano' },
    { name: 'Abuja Central',   lat: 9.0579,  lng: 7.4951, city: 'Abuja' },
    { name: 'Wuse, Abuja',     lat: 9.0726,  lng: 7.4892, city: 'Abuja' },
    { name: 'Garki, Abuja',    lat: 9.0380,  lng: 7.4900, city: 'Abuja' },
    { name: 'Maitama, Abuja',  lat: 9.0890,  lng: 7.4950, city: 'Abuja' },
  ];

  const CAMPAIGN_TYPES = [
    { value: 'brand_awareness', label: 'Brand Awareness' },
    { value: 'product_launch',  label: 'Product Launch' },
    { value: 'promotional',     label: 'Promotional' },
    { value: 'event',           label: 'Event' },
    { value: 'seasonal',        label: 'Seasonal' },
  ];

  let state = {
    step: 1,
    campaign: {
      name: '',
      type: 'brand_awareness',
      location_name: 'Kaduna Central',
      lat: 10.5105,
      lng: 7.4165,
      radius_meters: 5000,
      duration_days: 30,
      tricycles: 25,
      rate_type: 'fixed_daily',
      rate_amount: 500,
      verifications: 1,
      sticker_preview: null,
      sticker_size: 'medium',
    },
    contact: { full_name: '', email: '', phone: '', message: '' },
    submitting: false,
    error: '',
    verifying: false, // For CV simulation
  };

  function getVerificationPrice() {
    const loc = LOCATIONS.find(l => l.name === state.campaign.location_name);
    const city = loc ? loc.city : 'Kaduna';
    if (city === 'Abuja') return 300;
    if (city === 'Kano') return 150;
    return 200; // Kaduna & Zaria
  }

  // Leaflet references
  let map = null, marker = null, circle = null, miniMap = null, miniCircle = null;
  let leafletLoaded = false;

  // ── Budget calculation (mirrors web app logic) ─────────────────────
  function calcBudget() {
    const c = state.campaign;
    const avg = c.tricycles;
    
    // Calculate core ads cost (Base Cost)
    let adsCost = 0;
    if (c.rate_type === 'per_hour') {
      adsCost = c.duration_days * c.rate_amount * avg * 10;
    } else {
      adsCost = c.rate_amount * avg * c.duration_days;
    }
    
    // Platform fee (10%) applied to ads cost only
    const commission = Math.round(adsCost * 0.10);
    
    // Verifications
    const vPrice = getVerificationPrice();
    const vTotal = (c.rate_type === 'fixed_daily') ? (vPrice * c.verifications * avg) : 0;
    
    // Stickers
    const stickerPrices = { small: 1000, medium: 2000, large: 4000 };
    const stickerTotal = c.sticker_preview ? (stickerPrices[c.sticker_size] * avg) : 0;
    
    // Total sum
    const totalBase = adsCost + vTotal + stickerTotal;
    const grandTotal = totalBase + commission;
    
    return { 
      base: totalBase, // This is the sum of sub-costs
      adsCost: adsCost,
      commission: commission, 
      total: grandTotal 
    };
  }

  function budgetBreakdown() {
    const c = state.campaign;
    const avg = Math.ceil((20 + c.tricycles) / 2);
    if (c.rate_type === 'per_hour') {
      return `${c.duration_days} days x \u20A6${c.rate_amount}/hr x ${avg} tricycles x 10 hrs`;
    }
    return `\u20A6${c.rate_amount}/day x ${avg} tricycles x ${c.duration_days} days`;
  }

  function fmtMoney(n) {
    return '\u20A6' + Number(n).toLocaleString('en-NG');
  }

  // ── Leaflet loader ─────────────────────────────────────────────────
  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) { leafletLoaded = true; resolve(); return; }
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.crossOrigin = '';
      document.head.appendChild(css);

      const js = document.createElement('script');
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.crossOrigin = '';
      js.async = true;
      js.onload = () => { leafletLoaded = true; resolve(); };
      js.onerror = () => reject(new Error('Failed to load map'));
      document.head.appendChild(js);
    });
  }

  // ── Map helpers ────────────────────────────────────────────────────
  function initMap(containerId) {
    if (!window.L) return;
    const el = document.getElementById(containerId);
    if (!el || el._leaflet_id) return; // already initialised
    const c = state.campaign;
    map = L.map(el).setView([c.lat, c.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    marker = L.marker([c.lat, c.lng], { draggable: true }).addTo(map);
    circle = L.circle([c.lat, c.lng], {
      radius: c.radius_meters,
      color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.18
    }).addTo(map);

    marker.on('dragend', e => {
      const p = e.target.getLatLng();
      state.campaign.lat = p.lat;
      state.campaign.lng = p.lng;
      state.campaign.location_name = `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
      circle.setLatLng(p);
      clearActiveLocation();
    });
    map.on('click', e => {
      marker.setLatLng(e.latlng);
      circle.setLatLng(e.latlng);
      state.campaign.lat = e.latlng.lat;
      state.campaign.lng = e.latlng.lng;
      state.campaign.location_name = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
      clearActiveLocation();
    });
    setTimeout(() => map.invalidateSize(), 200);
  }

  function updateMapView() {
    if (!map) return;
    const c = state.campaign;
    map.setView([c.lat, c.lng], 12);
    marker.setLatLng([c.lat, c.lng]);
    circle.setLatLng([c.lat, c.lng]);
    circle.setRadius(c.radius_meters);
  }

  function clearActiveLocation() {
    document.querySelectorAll('.demo-loc-btn').forEach(b => b.classList.remove('active'));
  }

  function initMiniMap(containerId) {
    if (!window.L) return;
    const el = document.getElementById(containerId);
    if (!el || el._leaflet_id) return;
    const c = state.campaign;
    miniMap = L.map(el, { zoomControl: false, dragging: false, scrollWheelZoom: false, attributionControl: false })
      .setView([c.lat, c.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(miniMap);
    L.marker([c.lat, c.lng]).addTo(miniMap);
    miniCircle = L.circle([c.lat, c.lng], {
      radius: c.radius_meters,
      color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.18
    }).addTo(miniMap);
    setTimeout(() => miniMap.invalidateSize(), 200);
  }

  // ── Render helpers ─────────────────────────────────────────────────
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    });
    children.flat().forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function renderStickerPreviews(imgSrc) {
    if (!imgSrc) return 'Click to upload or drag sticker design';
    
    const tray = el('div', { className: 'demo-sticker-tray' });
    
    const prices = { small: 1000, medium: 2000, large: 4000 };
    
    ['small', 'medium', 'large'].forEach(size => {
      const isSelected = state.campaign.sticker_size === size;
      const card = el('div', { 
        className: `demo-sticker-card ${size}${isSelected ? ' selected' : ''}`,
        onClick: (e) => {
          e.stopPropagation(); // Don't trigger the upload zone click
          state.campaign.sticker_size = size;
          const zone = document.getElementById('demo-upload-zone');
          if (zone) {
            zone.innerHTML = '';
            zone.appendChild(renderStickerPreviews(imgSrc));
          }
          updateBudgetDisplay(); // Update budget when size changes
        }
      },
        el('div', { className: 'label' }, size),
        el('div', { className: 'preview-wrap' },
          el('img', { src: imgSrc })
        ),
        el('div', { style: 'font-size: 0.7rem; font-weight: 700; color: #6d28d9; margin-top: 4px;' }, fmtMoney(prices[size])),
        el('div', { className: 'check' }, isSelected ? '\u2713' : '')
      );
      tray.appendChild(card);
    });
    
    return tray;
  }

  // ── Step progress bar ──────────────────────────────────────────────
  function renderProgress() {
    const s = state.step;
    return el('div', { className: 'demo-steps' },
      ...[1,2,3].flatMap((n, i) => {
        const parts = [];
        const cls = n < s ? 'demo-step-dot done' : n === s ? 'demo-step-dot active' : 'demo-step-dot';
        parts.push(el('div', { className: cls }, n < s ? '\u2713' : String(n)));
        if (i < 2) parts.push(el('div', { className: 'demo-step-line' + (n < s ? ' done' : '') }));
        return parts;
      })
    );
  }

  // ── Step 1: Design Campaign ────────────────────────────────────────
  function renderStep1() {
    const c = state.campaign;
    const wrap = el('div', null);

    // Campaign name
    wrap.appendChild(field('Campaign Name', () => {
      const inp = el('input', { className: 'demo-input', placeholder: 'e.g. My First Campaign', value: c.name });
      inp.addEventListener('input', e => { c.name = e.target.value; });
      return inp;
    }));

    // Campaign type
    wrap.appendChild(field('Campaign Type', () => {
      const sel = el('select', { className: 'demo-select' });
      CAMPAIGN_TYPES.forEach(t => {
        const opt = el('option', { value: t.value }, t.label);
        if (t.value === c.type) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', e => { c.type = e.target.value; });
      return sel;
    }));

    // Quick-select locations
    wrap.appendChild(el('div', { className: 'demo-field' },
      el('label', { className: 'demo-label' }, 'Quick Select Location'),
      el('div', { className: 'demo-locations' },
        ...LOCATIONS.map(loc => {
          const btn = el('button', {
            className: 'demo-loc-btn' + (loc.name === c.location_name ? ' active' : ''),
            onClick: () => {
              c.lat = loc.lat; c.lng = loc.lng; c.location_name = loc.name;
              updateMapView();
              document.querySelectorAll('.demo-loc-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              updateBudgetDisplay();
            }
          }, loc.name);
          return btn;
        })
      )
    ));

    // Map
    wrap.appendChild(el('div', { className: 'demo-field' },
      el('label', { className: 'demo-label' }, 'Geofence Area (click map or drag marker)'),
      el('div', { id: 'demo-map', className: 'demo-map' })
    ));

    // Radius
    wrap.appendChild(el('div', { className: 'demo-field' },
      el('label', { className: 'demo-label' }, 'Radius'),
      el('div', { className: 'demo-radius-ctrl' },
        el('button', { className: 'demo-radius-btn', onClick: () => { c.radius_meters = Math.max(2000, c.radius_meters - 1000); updateMapView(); updateRadiusLabel(); }}, '\u2212'),
        el('span', { id: 'demo-radius-label', style: 'min-width:80px;text-align:center;font-weight:600;' },
          (c.radius_meters / 1000).toFixed(1) + ' km'),
        el('button', { className: 'demo-radius-btn', onClick: () => { c.radius_meters = Math.min(50000, c.radius_meters + 1000); updateMapView(); updateRadiusLabel(); }}, '+')
      )
    ));

    // Duration + Tricycles row
    wrap.appendChild(el('div', { className: 'demo-row' },
      field('Duration (days)', () => {
        const inp = el('input', { className: 'demo-input', type: 'number', min: '7', value: String(c.duration_days) });
        inp.addEventListener('input', e => { c.duration_days = Math.max(7, parseInt(e.target.value) || 7); updateBudgetDisplay(); });
        return inp;
      }),
      field('Number of Tricycles', () => {
        const inp = el('input', { className: 'demo-input', type: 'number', min: '20', value: String(c.tricycles) });
        inp.addEventListener('input', e => { c.tricycles = Math.max(20, parseInt(e.target.value) || 20); updateBudgetDisplay(); });
        return inp;
      })
    ));

    // Rate type + rate amount row
    wrap.appendChild(el('div', { className: 'demo-row' },
      field('Rate Type', () => {
        const sel = el('select', { className: 'demo-select' });
        [['fixed_daily','Fixed Daily Rate'],['per_hour','Per Hour']].forEach(([v,l]) => {
          const opt = el('option', { value: v }, l);
          if (v === c.rate_type) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', e => {
          c.rate_type = e.target.value;
          c.rate_amount = e.target.value === 'per_hour' ? 50 : 500;
          const rateInp = document.getElementById('demo-rate-input');
          if (rateInp) rateInp.value = c.rate_amount;
          const rateLabel = document.getElementById('demo-rate-label');
          if (rateLabel) rateLabel.textContent = c.rate_type === 'per_hour' ? 'Rate per Hour (\u20A6)' : 'Daily Rate (\u20A6)';
          
          // Toggle verifications visibility
          const vField = document.getElementById('demo-verifications-field');
          if (vField) vField.style.display = c.rate_type === 'fixed_daily' ? 'block' : 'none';
          
          updateBudgetDisplay();
        });
        return sel;
      }),
      field(c.rate_type === 'per_hour' ? 'Rate per Hour (\u20A6)' : 'Daily Rate (\u20A6)', () => {
        const inp = el('input', { className: 'demo-input', type: 'number', id: 'demo-rate-input', min: c.rate_type === 'per_hour' ? '15' : '100', value: String(c.rate_amount) });
        inp.addEventListener('input', e => { c.rate_amount = Math.max(0, parseFloat(e.target.value) || 0); updateBudgetDisplay(); });
        return inp;
      }, 'demo-rate-label')
    ));

    // Verifications (Only for fixed_daily)
    const vField = el('div', { id: 'demo-verifications-field', className: 'demo-field', style: `display: ${c.rate_type === 'fixed_daily' ? 'block' : 'none'};` },
      el('label', { className: 'demo-label' }, 'Total Verifications (per tricycle)'),
      el('input', { 
        className: 'demo-input', 
        type: 'number', 
        min: '1', 
        value: String(c.verifications),
        onInput: e => { c.verifications = Math.max(1, parseInt(e.target.value) || 1); updateBudgetDisplay(); }
      })
    );
    wrap.appendChild(vField);

    // Sticker Upload Simulation
    wrap.appendChild(el('div', { className: 'demo-field' },
      el('label', { className: 'demo-label' }, 'Campaign Sticker Design (Optional)'),
      el('div', { 
        className: 'demo-upload-zone',
        id: 'demo-upload-zone',
        style: 'border: 2px dashed #d1d5db; border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.2s;',
        onClick: () => {
          const mockFile = document.createElement('input');
          mockFile.type = 'file';
          mockFile.accept = 'image/*';
          mockFile.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (re) => {
                state.campaign.sticker_preview = re.target.result;
                const zone = document.getElementById('demo-upload-zone');
                zone.innerHTML = '';
                zone.appendChild(renderStickerPreviews(re.target.result));
                zone.style.borderColor = '#8b5cf6';
                zone.style.background = '#f5f3ff';
                updateBudgetDisplay();
              };
              reader.readAsDataURL(file);
            }
          };
          mockFile.click();
        }
      }, renderStickerPreviews(state.campaign.sticker_preview))
    ));

    // Budget display
    const b = calcBudget();
    wrap.appendChild(el('div', { className: 'demo-budget-display', id: 'demo-budget-box' },
      el('div', { style: 'font-size:.85rem;color:#6b7280;margin-bottom:4px;font-weight:600;' }, 'Estimated Total Budget'),
      el('div', { className: 'demo-budget-amount', id: 'demo-budget-amount' }, fmtMoney(b.total)),
      el('div', { className: 'demo-budget-breakdown', id: 'demo-budget-breakdown' }, `Base: ${fmtMoney(b.base)} + Platform Fee: ${fmtMoney(b.commission)}`)
    ));

    return wrap;
  }

  function field(label, inputFn, labelId) {
    const d = el('div', { className: 'demo-field' });
    const lbl = el('label', { className: 'demo-label' }, label);
    if (labelId) lbl.id = labelId;
    d.appendChild(lbl);
    d.appendChild(inputFn());
    return d;
  }

  function updateBudgetDisplay() {
    const amtEl = document.getElementById('demo-budget-amount');
    const brkEl = document.getElementById('demo-budget-breakdown');
    const b = calcBudget();
    const c = state.campaign;
    
    if (amtEl) amtEl.textContent = fmtMoney(b.total);
    
    if (brkEl) {
      const stickerPrices = { small: 1000, medium: 2000, large: 4000 };
      const stickerTotal = c.sticker_preview ? (stickerPrices[c.sticker_size] * c.tricycles) : 0;
      
      const vPrice = getVerificationPrice();
      const vTotal = (c.rate_type === 'fixed_daily') ? (vPrice * c.verifications * c.tricycles) : 0;
      
      let brkText = `Ads: ${fmtMoney(b.adsCost)}`;
      if (vTotal > 0) brkText += ` + Verifications: ${fmtMoney(vTotal)}`;
      if (stickerTotal > 0) brkText += ` + Stickers: ${fmtMoney(stickerTotal)}`;
      brkText += ` + Fee: ${fmtMoney(b.commission)}`;
      brkEl.textContent = brkText;
    }
  }

  function updateRadiusLabel() {
    const lbl = document.getElementById('demo-radius-label');
    if (lbl) lbl.textContent = (state.campaign.radius_meters / 1000).toFixed(1) + ' km';
  }

  // ── Step 2: Simulated Dashboard ────────────────────────────────────
  function renderStep2() {
    const c = state.campaign;
    const b = calcBudget();
    const totalBudget = b.total;

    // Simulate some real-time data for the premium feel
    const spentPct = 35 + Math.random() * 30; // 35-65%
    const exposureHours = Math.round(c.duration_days * c.tricycles * 10 * (spentPct / 100)); 
    const remainingDays = Math.max(1, Math.round(c.duration_days * ((100 - spentPct) / 100)));
    const riders = c.tricycles;

    const wrap = el('div', null);

    // Campaign header with a more premium look
    wrap.appendChild(el('div', { className: 'demo-dash-header' },
      el('div', null,
        el('h3', { className: 'demo-dash-title' }, c.name || 'Untitled Campaign'),
        el('div', { className: 'demo-dash-subtitle' },
          el('span', { className: 'demo-tag' }, CAMPAIGN_TYPES.find(t => t.value === c.type)?.label),
          el('span', null, el('i', { className: 'demo-icon-loc' }), c.location_name))
      ),
      el('div', { className: 'demo-status-container' },
        el('span', { className: 'demo-status-pulse' }),
        el('span', { className: 'demo-status-text' }, 'Live Now')
      )
    ));

    // Metric cards with icons and better styling
    wrap.appendChild(el('div', { className: 'demo-dash-grid' },
      dashCard('Total Budget', fmtMoney(totalBudget), '₦'),
      dashCard('Remaining', remainingDays + ' days', '📅'),
      dashCard('Exposure', exposureHours.toLocaleString() + ' hrs', '⏱'),
      dashCard('Fleet Size', String(riders), '🛺')
    ));

    // Live Economics Section
    const stickerPrices = { small: 1000, medium: 2000, large: 4000 };
    const stickerTotal = c.sticker_preview ? (stickerPrices[c.sticker_size] * c.tricycles) : 0;
    const vPrice = getVerificationPrice();
    const vTotal = c.rate_type === 'fixed_daily' ? (vPrice * c.verifications * c.tricycles) : 0;
    const adsBase = b.base - vTotal - stickerTotal;

    const ecoBox = el('div', { className: 'demo-eco-card' },
      el('div', { className: 'demo-eco-header' }, 
        el('span', null, 'Campaign Economics'),
        el('span', { className: 'demo-eco-badge' }, 'Real-time')
      ),
      el('div', { className: 'demo-eco-body' },
        ecoRow('Base Cost', fmtMoney(b.adsCost)),
        ...(c.rate_type === 'fixed_daily' ? [ecoRow('Verifications', fmtMoney(vTotal))] : []),
        ...(stickerTotal > 0 ? [ecoRow('Sticker Printing', fmtMoney(stickerTotal))] : []),
        ecoRow('Platform Fee', fmtMoney(b.commission)),
        ecoRow('Estimated VAT (7.5%)', fmtMoney(Math.round(totalBudget * 0.075))),
        el('div', { className: 'demo-eco-total' },
          el('span', null, 'Projected Total'),
          el('span', null, fmtMoney(totalBudget + Math.round(totalBudget * 0.075)))
        )
      )
    );
    wrap.appendChild(ecoBox);

    // Budget utilisation bar with premium styling
    wrap.appendChild(el('div', { className: 'demo-field' },
      el('div', { className: 'demo-progress-label' },
        el('span', null, 'Budget Utilization'),
        el('span', { className: 'demo-pct-text' }, Math.round(spentPct) + '%')
      ),
      el('div', { className: 'demo-progress-container' },
        el('div', { className: 'demo-progress-fill-premium', style: 'width:' + spentPct + '%;' })
      )
    ));

    // Mini map
    wrap.appendChild(el('div', { className: 'demo-field' },
      el('label', { className: 'demo-label' }, 'Geofence Coverage'),
      el('div', { id: 'demo-minimap-premium', className: 'demo-minimap-premium' })
    ));

    // Simulation Notice
    wrap.appendChild(el('div', { className: 'demo-notice-green' }, 
      '✨ This dashboard visualizes your campaign performance in real-time. Data is simulated based on your configuration.'
    ));

    return wrap;
  }

  function ecoRow(label, value) {
    return el('div', { className: 'demo-eco-row' },
      el('span', { className: 'label' }, label),
      el('span', { className: 'value' }, value)
    );
  }

  function dashCard(label, value, icon) {
    return el('div', { className: 'demo-dash-card-premium' },
      el('div', { className: 'icon' }, icon),
      el('div', { className: 'content' },
        el('div', { className: 'label' }, label),
        el('div', { className: 'value' }, value)
      )
    );
  }

  // ── Step 3: Connect with Agencies ──────────────────────────────────
  function renderStep3() {
    const wrap = el('div', null);

    // Minimal contact form
    wrap.appendChild(el('div', { style: 'border-top:1px solid #e5e7eb;padding-top:16px;margin-top:8px;' },
      el('label', { className: 'demo-label', style: 'font-size:.9rem;margin-bottom:10px;display:block;' }, 'Your Contact Details')
    ));

    wrap.appendChild(field('Full Name', () => {
      const inp = el('input', { className: 'demo-input', placeholder: 'Your full name', value: state.contact.full_name });
      inp.addEventListener('input', e => { state.contact.full_name = e.target.value; prefillMessage(); });
      return inp;
    }));

    wrap.appendChild(el('div', { className: 'demo-row' },
      field('Email', () => {
        const inp = el('input', { className: 'demo-input', type: 'email', placeholder: 'email@example.com', value: state.contact.email });
        inp.addEventListener('input', e => { state.contact.email = e.target.value; });
        return inp;
      }),
      field('Phone *', () => {
        const inp = el('input', { className: 'demo-input', type: 'tel', placeholder: '080XXXXXXXX', value: state.contact.phone });
        inp.addEventListener('input', e => { state.contact.phone = e.target.value; });
        return inp;
      })
    ));

    wrap.appendChild(field('Message (optional)', () => {
      const ta = el('textarea', { className: 'demo-textarea', id: 'demo-message', placeholder: 'Tell us about your needs...' });
      ta.value = state.contact.message || buildPrefillMessage();
      ta.addEventListener('input', e => { state.contact.message = e.target.value; });
      if (!state.contact.message) state.contact.message = buildPrefillMessage();
      return ta;
    }));

    // Error display
    if (state.error) {
      wrap.appendChild(el('div', { className: 'demo-error' }, state.error));
    }

    return wrap;
  }

  function buildPrefillMessage() {
    const c = state.campaign;
    const name = state.contact.full_name || 'Client';
    const typeLbl = CAMPAIGN_TYPES.find(t => t.value === c.type)?.label || c.type;
    const rateLbl = c.rate_type === 'per_hour' ? `\u20A6${c.rate_amount}/hour` : `\u20A6${c.rate_amount}/day`;
    const stickerPart = c.sticker_preview ? ` with ${c.sticker_size} stickers` : '';
    const verificationPart = c.rate_type === 'fixed_daily' ? ` and ${c.verifications} verifications per tricycle` : '';
    
    return `Hello, I am ${name} and I would like you to help me create a ${typeLbl} campaign in ${c.location_name} for a duration of ${c.duration_days} days with ${c.tricycles} tricycles${stickerPart}${verificationPart} at a rate of ${rateLbl}. The estimated budget is ${fmtMoney(calcBudget().total)}. Please get in touch so we can discuss further.`;
  }

  function prefillMessage() {
    const ta = document.getElementById('demo-message');
    if (ta) {
      state.contact.message = buildPrefillMessage();
      ta.value = state.contact.message;
    }
  }

  // ── Success state ──────────────────────────────────────────────────
  function renderSuccess() {
    const wrap = el('div', { className: 'demo-success' },
      el('div', { className: 'demo-success-icon' }, '\u2713'),
      el('h3', { style: 'margin:0 0 8px;' }, 'Request Sent!'),
      el('p', { style: 'color:#6b7280;margin:0 0 20px;' },
        'Your interest has been received. Our team will be in touch with you soon!'),
      el('button', { className: 'demo-btn demo-btn-primary', onClick: close }, 'Close')
    );
    return wrap;
  }

  // ── Main render ────────────────────────────────────────────────────
  function render() {
    const body = document.getElementById('demo-body');
    if (!body) return;
    body.innerHTML = '';

    // Update Header Title based on step
    const headerTitle = document.querySelector('.demo-header h2');
    if (headerTitle) {
      if (state.step === 1) headerTitle.textContent = 'Create Campaign';
      else if (state.step === 2) headerTitle.textContent = 'Campaign Dashboard';
      else if (state.step === 3) headerTitle.textContent = 'Submit Campaign';
    }

    // Progress
    body.appendChild(renderProgress());

    // Step content
    let content;
    if (state.step === 1) content = renderStep1();
    else if (state.step === 2) content = renderStep2();
    else content = renderStep3();

    const contentWrap = el('div', { className: 'demo-body' });
    contentWrap.appendChild(content);

    // Nav buttons
    const nav = el('div', { className: 'demo-nav' });
    if (state.step > 1) {
      nav.appendChild(el('button', { className: 'demo-btn demo-btn-secondary', onClick: () => goStep(state.step - 1) }, '\u2190 Back'));
    } else {
      nav.appendChild(el('div'));
    }
    if (state.step < 3) {
      nav.appendChild(el('button', { className: 'demo-btn demo-btn-primary', onClick: () => goStep(state.step + 1) }, 'Next \u2192'));
    } else {
      const submitBtn = el('button', {
        className: 'demo-btn demo-btn-primary',
        id: 'demo-submit-btn',
        onClick: submit
      }, 'Submit Campaign');
      nav.appendChild(submitBtn);
    }
    contentWrap.appendChild(nav);
    body.appendChild(contentWrap);

    // Post-render: init maps
    if (state.step === 1) {
      loadLeaflet().then(() => {
        initMap('demo-map');
      }).catch(() => {
        const mapEl = document.getElementById('demo-map');
        if (mapEl) mapEl.innerHTML = '<div class="demo-map-loading">Could not load map</div>';
      });
    }
    if (state.step === 2) {
      loadLeaflet().then(() => {
        initMiniMap('demo-minimap-premium');
      }).catch(() => {});
    }
  }

  function goStep(n) {
    // Validation before proceeding
    if (state.step === 1 && n === 2) {
      if (!state.campaign.name.trim()) {
        alert('Please enter a campaign name.');
        return;
      }
      
      const c = state.campaign;
      const minRate = c.rate_type === 'per_hour' ? 15 : 100;
      if (c.rate_amount < minRate) {
        alert(`Minimum rate for ${c.rate_type === 'per_hour' ? 'hourly' : 'daily'} campaigns is \u20A6${minRate}.`);
        return;
      }
    }

    // Clean up existing maps when leaving a step
    if (state.step === 1 && map) {
      map.remove(); map = null; marker = null; circle = null;
    }
    if (state.step === 2 && miniMap) {
      miniMap.remove(); miniMap = null; miniCircle = null;
    }

    state.step = n;
    state.error = '';

    // Fetch data when entering step 3 (if needed)
    if (n === 3) {
      // Logic for step 3 entry
    }

    render();

    // Scroll panel to top
    const panel = document.querySelector('.demo-panel');
    if (panel) panel.scrollTop = 0;
  }

  // ── API calls ──────────────────────────────────────────────────────


  function submit() {
    const ct = state.contact;
    state.error = '';

    // Validation
    if (!ct.phone.trim()) { state.error = 'Phone number is required.'; render(); return; }
    if (ct.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ct.email)) { state.error = 'Enter a valid email address.'; render(); return; }

    state.submitting = true;
    const btn = document.getElementById('demo-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="demo-spinner"></span>Sending...'; }

    const c = state.campaign;
    const payload = {
      full_name: ct.full_name.trim(),
      email: ct.email.trim(),
      phone: ct.phone.trim(),
      message: ct.message.trim(),
      agency_ids: [],
      campaign_concept: {
        name: c.name,
        type: c.type,
        location_name: c.location_name,
        lat: c.lat,
        lng: c.lng,
        radius_km: +(c.radius_meters / 1000).toFixed(1),
        duration_days: c.duration_days,
        tricycles: c.tricycles,
        rate_type: c.rate_type,
        rate_amount: c.rate_amount,
        verifications: c.verifications,
        sticker_size: c.sticker_size,
        sticker_image: c.sticker_preview,
        budget: fmtMoney(calcBudget().total),
      }
    };

    fetch(API_BASE + '/demo-interest/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(data => {
        state.submitting = false;
        if (data.success) {
          // Show success
          const body = document.getElementById('demo-body');
          if (body) {
            body.innerHTML = '';
            body.appendChild(renderProgress());
            const bdy = el('div', { className: 'demo-body' });
            bdy.appendChild(renderSuccess());
            body.appendChild(bdy);
          }
        } else {
          state.error = data.message || 'Something went wrong. Please try again.';
          render();
        }
      })
      .catch(() => {
        state.submitting = false;
        state.error = 'Network error. Please check your connection and try again.';
        render();
      });
  }

  // ── Open / Close ───────────────────────────────────────────────────
  function open() {
    // Reset state
    state.step = 1;
    state.contact = { full_name: '', email: '', phone: '', message: '' };
    state.error = '';
    state.submitting = false;
    map = null; marker = null; circle = null; miniMap = null; miniCircle = null;

    const overlay = document.getElementById('demo-overlay');
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      render();
    }
  }

  function close() {
    // Clean up maps
    if (map) { try { map.remove(); } catch(e){} map = null; marker = null; circle = null; }
    if (miniMap) { try { miniMap.remove(); } catch(e){} miniMap = null; miniCircle = null; }

    const overlay = document.getElementById('demo-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ── Public API ─────────────────────────────────────────────────────
  return { open, close };
})();
