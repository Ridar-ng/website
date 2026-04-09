/**
 * Stika "Try It Yourself" Demo
 * 3-step wizard: Design Campaign → Preview Dashboard → Connect with Agencies
 */
const StikaDemo = (() => {
  // ── State ──────────────────────────────────────────────────────────
  const API_BASE = 'https://bold.stika.ng/api/v1/agencies';

  const LOCATIONS = [
    { name: 'Kaduna Central', lat: 10.5105, lng: 7.4165 },
    { name: 'Rigasa, Kaduna',  lat: 10.5410, lng: 7.3750 },
    { name: 'Zaria',           lat: 11.0801, lng: 7.7069 },
    { name: 'Barnawa, Kaduna', lat: 10.4833, lng: 7.4333 },
    { name: 'Kano City',       lat: 12.0022, lng: 8.5920 },
    { name: 'Sabon Gari, Kano',lat: 11.9700, lng: 8.5300 },
    { name: 'Abuja Central',   lat: 9.0579,  lng: 7.4951 },
    { name: 'Wuse, Abuja',     lat: 9.0726,  lng: 7.4892 },
    { name: 'Garki, Abuja',    lat: 9.0380,  lng: 7.4900 },
    { name: 'Maitama, Abuja',  lat: 9.0890,  lng: 7.4950 },
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
    },
    agencies: [],
    selectedAgencies: new Set(),
    contact: { full_name: '', email: '', phone: '', message: '' },
    submitting: false,
    error: '',
  };

  // Leaflet references
  let map = null, marker = null, circle = null, miniMap = null, miniCircle = null;
  let leafletLoaded = false;

  // ── Budget calculation (mirrors web app logic) ─────────────────────
  function calcBudget() {
    const c = state.campaign;
    const minRiders = 20;
    const avg = Math.ceil((minRiders + c.tricycles) / 2);
    if (c.rate_type === 'per_hour') {
      return c.duration_days * c.rate_amount * avg * 10;
    }
    // fixed_daily
    return c.rate_amount * avg * c.duration_days;
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

    // Budget display
    wrap.appendChild(el('div', { className: 'demo-budget-display', id: 'demo-budget-box' },
      el('div', { style: 'font-size:.75rem;color:#6b7280;margin-bottom:2px;' }, 'Estimated Campaign Budget'),
      el('div', { className: 'demo-budget-amount', id: 'demo-budget-amount' }, fmtMoney(calcBudget())),
      el('div', { className: 'demo-budget-breakdown', id: 'demo-budget-breakdown' }, budgetBreakdown())
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
    if (amtEl) amtEl.textContent = fmtMoney(calcBudget());
    if (brkEl) brkEl.textContent = budgetBreakdown();
  }

  function updateRadiusLabel() {
    const lbl = document.getElementById('demo-radius-label');
    if (lbl) lbl.textContent = (state.campaign.radius_meters / 1000).toFixed(1) + ' km';
  }

  // ── Step 2: Simulated Dashboard ────────────────────────────────────
  function renderStep2() {
    const c = state.campaign;
    const baseBudget = calcBudget();
    const commission = Math.round(baseBudget * 0.05); // 5% platform fee
    const subtotal = baseBudget + commission;
    const vat = Math.round(subtotal * 0.075); // 7.5% VAT
    const totalBudget = subtotal + vat;

    const spentPct = 35 + Math.random() * 30; // 35-65%
    const spent = Math.round(totalBudget * spentPct / 100);
    const exposureHours = c.duration_days * c.tricycles * 10; // 10 working hours per day
    const riders = Math.max(5, Math.floor(baseBudget / 5000));

    const wrap = el('div', null);

    // Campaign header
    wrap.appendChild(el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;' },
      el('div', null,
        el('h3', { style: 'margin:0;font-size:1.1rem;' }, c.name || 'Untitled Campaign'),
        el('div', { style: 'font-size:.78rem;color:#6b7280;margin-top:2px;' },
          CAMPAIGN_TYPES.find(t => t.value === c.type)?.label + ' \u2022 ' + c.location_name)
      ),
      el('span', { className: 'demo-status-badge' }, 'Active')
    ));

    // Metric cards
    wrap.appendChild(el('div', { className: 'demo-dash-grid' },
      dashCard('Total Cost', fmtMoney(totalBudget)),
      dashCard('Spent', fmtMoney(spent)),
      dashCard('Exposure Hrs', exposureHours.toLocaleString()),
      dashCard('Riders', String(riders)),
      dashCard('Duration', c.duration_days + ' days'),
      dashCard('Remaining', '14 days'),
      dashCard('Geofences', '1'),
      dashCard('Radius', (c.radius_meters / 1000).toFixed(1) + ' km')
    ));

    // Cost breakdown
    wrap.appendChild(el('div', { style: 'background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:12px;' },
      el('div', { style: 'font-size:.8rem;font-weight:600;color:#374151;margin-bottom:8px;' }, 'Cost Breakdown'),
      el('div', { style: 'display:flex;justify-content:space-between;font-size:.78rem;color:#6b7280;margin-bottom:4px;' },
        el('span', null, 'Campaign Budget'),
        el('span', null, fmtMoney(baseBudget))
      ),
      el('div', { style: 'display:flex;justify-content:space-between;font-size:.78rem;color:#6b7280;margin-bottom:4px;' },
        el('span', null, 'Platform Fee (5%)'),
        el('span', null, fmtMoney(commission))
      ),
      el('div', { style: 'display:flex;justify-content:space-between;font-size:.78rem;color:#6b7280;margin-bottom:8px;' },
        el('span', null, 'VAT (7.5%)'),
        el('span', null, fmtMoney(vat))
      ),
      el('div', { style: 'display:flex;justify-content:space-between;font-size:.85rem;font-weight:700;color:#1f2937;border-top:1px solid #e5e7eb;padding-top:8px;' },
        el('span', null, 'Total'),
        el('span', null, fmtMoney(totalBudget))
      )
    ));

    // Budget utilisation bar
    wrap.appendChild(el('div', { className: 'demo-field' },
      el('div', { style: 'display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:2px;' },
        el('span', null, 'Budget Utilisation'),
        el('span', { style: 'font-weight:600;' }, Math.round(spentPct) + '%')
      ),
      el('div', { className: 'demo-progress-bar' },
        el('div', { className: 'demo-progress-fill', style: 'width:' + spentPct + '%;' })
      )
    ));

    // Mini map
    wrap.appendChild(el('div', { className: 'demo-field' },
      el('label', { className: 'demo-label' }, 'Campaign Geofence'),
      el('div', { id: 'demo-minimap', className: 'demo-minimap' })
    ));

    // Info note - simulated preview
    wrap.appendChild(el('div', {
      style: 'background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;font-size:.8rem;color:#166534;margin-top:12px;'
    }, 'This is a simulated preview of what your campaign dashboard would look like. Actual results will vary based on real-world conditions.'));

    // Info note - other charges
    wrap.appendChild(el('div', {
      style: 'background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:12px;font-size:.78rem;color:#854d0e;margin-top:10px;'
    }, 'Note: Please contact the agency for other charges such as sticker printing, agency commission, and regulatory fees.'));

    return wrap;
  }

  function dashCard(label, value) {
    return el('div', { className: 'demo-dash-card' },
      el('div', { className: 'label' }, label),
      el('div', { className: 'value' }, value)
    );
  }

  // ── Step 3: Connect with Agencies ──────────────────────────────────
  function renderStep3() {
    const wrap = el('div', null);

    // Agency grid
    wrap.appendChild(el('label', { className: 'demo-label', style: 'margin-bottom:8px;display:block;' },
      'Select agencies to connect with'));

    if (state.agencies.length === 0) {
      wrap.appendChild(el('div', { className: 'demo-map-loading', style: 'height:100px;' }, 'Loading agencies...'));
    } else {
      const grid = el('div', { className: 'demo-agencies-grid' });
      state.agencies.forEach(ag => {
        const card = el('div', {
          className: 'demo-agency-card' + (state.selectedAgencies.has(ag.id) ? ' selected' : ''),
          onClick: () => {
            if (state.selectedAgencies.has(ag.id)) state.selectedAgencies.delete(ag.id);
            else state.selectedAgencies.add(ag.id);
            card.classList.toggle('selected');
            card.querySelector('.check').textContent = state.selectedAgencies.has(ag.id) ? '\u2713' : '';
          }
        },
          ag.logo ? el('img', { className: 'demo-agency-logo', src: ag.logo, alt: ag.name }) :
            el('div', { className: 'demo-agency-logo', style: 'display:flex;align-items:center;justify-content:center;font-weight:700;color:#8b5cf6;font-size:1.1rem;' }, ag.name.charAt(0)),
          el('div', { className: 'name' }, ag.name),
          el('div', { className: 'meta' }, [ag.city, ag.state].filter(Boolean).join(', ')),
          el('div', { className: 'meta' }, ag.agency_type + (ag.total_campaigns ? ' \u2022 ' + ag.total_campaigns + ' campaigns' : '')),
          ag.client_commission_rate != null ? el('div', { className: 'meta', style: 'color:#6d28d9;font-weight:600;' }, 'Commission: ' + ag.client_commission_rate + '%') : null,
          el('div', { className: 'check' }, state.selectedAgencies.has(ag.id) ? '\u2713' : '')
        );
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
    }

    // Minimal contact form
    wrap.appendChild(el('div', { style: 'border-top:1px solid #e5e7eb;padding-top:16px;margin-top:8px;' },
      el('label', { className: 'demo-label', style: 'font-size:.9rem;margin-bottom:10px;display:block;' }, 'Your Contact Details')
    ));

    wrap.appendChild(field('Full Name *', () => {
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
      field('Phone', () => {
        const inp = el('input', { className: 'demo-input', type: 'tel', placeholder: '080XXXXXXXX', value: state.contact.phone });
        inp.addEventListener('input', e => { state.contact.phone = e.target.value; });
        return inp;
      })
    ));

    wrap.appendChild(field('Message (optional)', () => {
      const ta = el('textarea', { className: 'demo-textarea', id: 'demo-message', placeholder: 'Tell the agency about your needs...' });
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
    const name = state.contact.full_name || '[Name]';
    const typeLbl = CAMPAIGN_TYPES.find(t => t.value === c.type)?.label || c.type;
    const rateLbl = c.rate_type === 'per_hour' ? `\u20A6${c.rate_amount}/hour` : `\u20A6${c.rate_amount}/day`;
    return `Hello, I am ${name} and I would like you to help me create a ${typeLbl} campaign in ${c.location_name} for a duration of ${c.duration_days} days with ${c.tricycles} tricycles at a rate of ${rateLbl}. The estimated budget is ${fmtMoney(calcBudget())}. Please get in touch so we can discuss further.`;
  }

  function prefillMessage() {
    const ta = document.getElementById('demo-message');
    if (ta) {
      state.contact.message = buildPrefillMessage();
      ta.value = state.contact.message;
    }
  }

  // ── Success state ──────────────────────────────────────────────────
  function renderSuccess(count) {
    const wrap = el('div', { className: 'demo-success' },
      el('div', { className: 'demo-success-icon' }, '\u2713'),
      el('h3', { style: 'margin:0 0 8px;' }, 'Request Sent!'),
      el('p', { style: 'color:#6b7280;margin:0 0 20px;' },
        `Your interest has been sent to ${count} ${count === 1 ? 'agency' : 'agencies'}. They will be in touch soon!`),
      el('button', { className: 'demo-btn demo-btn-primary', onClick: close }, 'Close')
    );
    return wrap;
  }

  // ── Main render ────────────────────────────────────────────────────
  function render() {
    const body = document.getElementById('demo-body');
    if (!body) return;
    body.innerHTML = '';

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
      }, 'Send Request');
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
        initMiniMap('demo-minimap');
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

    // Fetch agencies when entering step 3
    if (n === 3 && state.agencies.length === 0) fetchAgencies();

    render();

    // Scroll panel to top
    const panel = document.querySelector('.demo-panel');
    if (panel) panel.scrollTop = 0;
  }

  // ── API calls ──────────────────────────────────────────────────────
  function fetchAgencies() {
    fetch(API_BASE + '/public/')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        if (data.success && data.agencies) {
          state.agencies = data.agencies;
        } else {
          state.agencies = [];
          state.error = 'No agencies available at the moment.';
        }
        render();
      })
      .catch(err => {
        console.error('Failed to load agencies:', err);
        state.agencies = [];
        state.error = 'Could not load agencies. Please try again later.';
        render();
      });
  }

  function submit() {
    const ct = state.contact;
    state.error = '';

    // Validation
    if (!ct.full_name.trim()) { state.error = 'Name is required.'; render(); return; }
    if (!ct.email.trim() && !ct.phone.trim()) { state.error = 'Email or phone is required.'; render(); return; }
    if (state.selectedAgencies.size === 0) { state.error = 'Please select at least one agency.'; render(); return; }
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
      agency_ids: Array.from(state.selectedAgencies),
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
        budget: fmtMoney(calcBudget()),
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
            bdy.appendChild(renderSuccess(data.requests_created || state.selectedAgencies.size));
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
    state.selectedAgencies = new Set();
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
