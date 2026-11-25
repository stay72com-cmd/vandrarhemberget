/* Vandrarhem Berget – det som behöver skript.
   Sidan fungerar utan: bokningen är ett vanligt formulär, bilderna är länkar. */
(() => {
  'use strict';

  const d = document;
  d.documentElement.classList.add('js');

  const hitta = (valjare, i = d) => i.querySelector(valjare);
  const hittaAlla = (valjare, i = d) => [...i.querySelectorAll(valjare)];

  let info = {};
  try {
    info = JSON.parse(hitta('#sidinfo').textContent);
  } catch {
    /* Utan sidinfo hoppas prisraden och kartan över; resten fungerar. */
  }
  const t = info.t || {};

  /* Meny på små skärmar */
  const menyknapp = hitta('[data-menyknapp]');
  const meny = hitta('[data-meny]');
  if (menyknapp && meny) {
    const stang = () => {
      meny.classList.remove('ar-oppen');
      menyknapp.setAttribute('aria-expanded', 'false');
    };
    menyknapp.addEventListener('click', () => {
      const oppen = meny.classList.toggle('ar-oppen');
      menyknapp.setAttribute('aria-expanded', String(oppen));
    });
    meny.addEventListener('click', (h) => {
      if (h.target.closest('a')) stang();
    });
    d.addEventListener('keydown', (h) => {
      if (h.key === 'Escape' && meny.classList.contains('ar-oppen')) {
        stang();
        menyknapp.focus();
      }
    });
  }

  /* Språkvalet: stäng när besökaren klickar utanför eller trycker Esc */
  const sprakval = hitta('[data-sprakval]');
  if (sprakval) {
    d.addEventListener('click', (h) => {
      if (sprakval.open && !sprakval.contains(h.target)) sprakval.open = false;
    });
    sprakval.addEventListener('keydown', (h) => {
      if (h.key === 'Escape' && sprakval.open) {
        sprakval.open = false;
        hitta('summary', sprakval).focus();
      }
    });
  }

  /* Har besökaren ett annat av sidans språk i sin webbläsare? Erbjud det, en gång,
     i en rad överst. Inget sparas och ingen skickas vidare av sig själv. */
  const sprakrad = hitta('[data-sprakrad]');
  if (sprakrad && Array.isArray(info.andraSprak) && info.andraSprak.length) {
    const onskade = (navigator.languages || [navigator.language || ''])
      .map((kod) => kod.toLowerCase().split('-')[0])
      .map((kod) => (kod === 'no' || kod === 'nn' ? 'nb' : kod));
    const forsta = onskade.find((kod) => kod === info.sprak || info.andraSprak.some((s) => s.kod === kod));
    const forslag = forsta && forsta !== info.sprak && info.andraSprak.find((s) => s.kod === forsta);
    if (forslag) {
      const lank = d.createElement('a');
      lank.href = forslag.lank;
      lank.lang = forslag.kod;
      lank.hreflang = forslag.kod;
      lank.textContent = forslag.text + ' →';
      const stang = d.createElement('button');
      stang.type = 'button';
      stang.setAttribute('aria-label', t.stang || 'Stäng');
      stang.textContent = '×';
      stang.addEventListener('click', () => (sprakrad.hidden = true));
      sprakrad.append(lank, stang);
      sprakrad.hidden = false;
    }
  }

  /* Tunn linje under sidhuvudet när sidan har rullats */
  const topp = hitta('[data-topp]');
  if (topp) {
    const markera = () => topp.classList.toggle('ar-rullad', window.scrollY > 8);
    window.addEventListener('scroll', markera, { passive: true });
    markera();
  }

  /* Bokningsrutan: egen kalender, gäster utan tak och förslag på rum.
     Utan skript är rutan ett vanligt formulär med webbläsarens egna datumfält. */
  const formular = hitta('[data-bokning]');
  const kalender = formular && hitta('[data-kalender]', formular);
  if (formular && kalender && info.minNatter && info.rum) {
    const DYGN = 864e5;
    const MINST = info.minNatter * DYGN;
    const inn = formular.elements.check_in_date;
    const ut = formular.elements.check_out_date;
    const gaster = formular.elements.guests;
    const lok = info.talformat;
    const tal = new Intl.NumberFormat(lok);
    const flertal = new Intl.PluralRules(lok);

    const somTal = (text) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
    };
    const somText = (v) => new Date(v).toISOString().slice(0, 10);
    const finns = (v) => !Number.isNaN(v);
    const idag = () => {
      const delar = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Stockholm',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const del = (typ) => delar.find((p) => p.type === typ).value;
      return `${del('year')}-${del('month')}-${del('day')}`;
    };
    const visa = (rad, text) => {
      rad.textContent = text;
      rad.hidden = !text;
    };
    /* «one:{n} natt|other:{n} nätter» ger rätt form för antalet på sidans språk. */
    const antalText = (text, n) => {
      const former = {};
      text.split('|').forEach((del) => {
        const kolon = del.indexOf(':');
        former[del.slice(0, kolon)] = del.slice(kolon + 1);
      });
      return (former[flertal.select(n)] || former.other || '').replace('{n}', n);
    };
    const el = (namn, klass, text) => {
      const nytt = d.createElement(namn);
      if (klass) nytt.className = klass;
      if (text !== undefined) nytt.textContent = text;
      return nytt;
    };

    /* Kalendern. En dag är alltid midnatt UTC, så att sommartid aldrig flyttar ett datum. */
    const forst = somTal(idag());
    const sist = Date.UTC(new Date(forst).getUTCFullYear(), new Date(forst).getUTCMonth() + 18, new Date(forst).getUTCDate());
    const manadFor = (v) => new Date(v).getUTCFullYear() * 12 + new Date(v).getUTCMonth();
    const forstaManad = manadFor(forst);
    const sistaManad = manadFor(sist);
    const veckodag = (v) => (new Date(v).getUTCDay() + 6) % 7; /* måndag = 0 */

    const format = (val) => new Intl.DateTimeFormat(lok, { timeZone: 'UTC', ...val });
    const medVeckodag = format({ weekday: 'short', day: 'numeric', month: 'short' });
    const utanVeckodag = format({ day: 'numeric', month: 'short' });
    const medAr = format({ day: 'numeric', month: 'short', year: 'numeric' });
    const helDag = format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const manadsnamn = format({ month: 'long', year: 'numeric' });
    /* Lettiskans «trešd., 29. sept.» ryms inte i knappen på en smal skärm: då utan veckodag.
       Ligger datumet nästan ett år bort står året med, så att det inte går att ta miste. */
    const langt = medVeckodag.format(Date.UTC(2027, 8, 29)).length > 14;
    const kort = (v) => (v - forst > 330 * DYGN ? medAr : langt ? utanVeckodag : medVeckodag).format(v);
    const MANDAG = Date.UTC(2024, 0, 1);
    const dagnamn = (stil) =>
      Array.from({ length: 7 }, (_, nr) => format({ weekday: stil }).format(MANDAG + nr * DYGN).replace(/\.$/, ''));
    const veckodagar = dagnamn('short').some((namn) => namn.length > 4) ? dagnamn('narrow') : dagnamn('short');

    const datum = hitta('[data-datum]', formular);
    const knappar = {
      start: hitta('[data-datum-knapp="start"]', datum),
      slut: hitta('[data-datum-knapp="slut"]', datum),
    };
    const tomt = hitta('[data-datum-varde]', knappar.start).textContent;
    const manader = hitta('[data-kal-manader]', kalender);
    const tips = hitta('[data-kal-tips]', kalender);
    const blad = { '-1': hitta('[data-kal-forra]', kalender), 1: hitta('[data-kal-nasta]', kalender) };
    const bred = window.matchMedia('(min-width: 54rem)');
    const antalManader = () => (bred.matches ? 2 : 1);

    let start = NaN;
    let slut = NaN;
    let lage = 'start'; /* vilket datum nästa klick i kalendern väljer */
    let forhand = NaN; /* dagen som pekaren eller fokus står på medan utcheckningen väljs */
    let fokusdag = forst; /* dagen som nås med tabb */
    let visad = forstaManad; /* första månaden som syns */
    let oppnare = null;
    let uppdatera = () => {}; /* sätts längre ner, när förslagen finns */

    const ritaManad = (m) => {
      const ar = Math.floor(m / 12);
      const manad = m % 12;
      const antal = new Date(Date.UTC(ar, manad + 1, 0)).getUTCDate();
      const ruta = el('div', 'kalender__manad');
      const titel = el('p', 'kalender__titel', manadsnamn.format(Date.UTC(ar, manad, 1)));
      titel.id = `kalender-${m}`;
      const rad = el('div', 'kalender__veckodagar');
      rad.setAttribute('aria-hidden', 'true');
      veckodagar.forEach((namn) => rad.append(el('span', '', namn)));
      const dagar = el('div', 'kalender__dagar');
      dagar.setAttribute('role', 'group');
      dagar.setAttribute('aria-labelledby', titel.id);
      for (let nr = 1; nr <= antal; nr += 1) {
        const v = Date.UTC(ar, manad, nr);
        const knapp = el('button', 'dag', nr);
        knapp.type = 'button';
        knapp.dataset.dag = somText(v);
        knapp.setAttribute('aria-label', helDag.format(v));
        if (nr === 1) knapp.style.gridColumnStart = veckodag(v) + 1;
        dagar.append(knapp);
      }
      ruta.append(titel, rad, dagar);
      return ruta;
    };

    const visaTips = (varning) => {
      const text =
        varning ||
        (!finns(start)
          ? t.valjIn
          : !finns(slut)
            ? `${t.valjUt} · ${t.minst}`
            : `${kort(start)} – ${kort(slut)} · ${antalText(t.natter, (slut - start) / DYGN)}`);
      tips.classList.toggle('ar-varning', !!varning);
      if (tips.textContent !== text) tips.textContent = text;
    };

    /* Sätter utseende och läge på varje dag som syns. */
    const markera = () => {
      const till = finns(slut) ? slut : forhand;
      hittaAlla('.dag', manader).forEach((knapp) => {
        const v = somTal(knapp.dataset.dag);
        const mellan = finns(start) && finns(till) && v > start && v < till;
        const forKort = lage === 'slut' && finns(start) && v > start && v - start < MINST;
        knapp.disabled = v < forst || v > sist;
        knapp.classList.toggle('ar-start', v === start);
        knapp.classList.toggle('ar-kopplad', v === start && finns(till) && till > start);
        knapp.classList.toggle('ar-slut', v === slut);
        knapp.classList.toggle('ar-mellan', mellan && finns(slut));
        knapp.classList.toggle('ar-forhand', !finns(slut) && (mellan || v === forhand));
        knapp.classList.toggle('ar-forhandsslut', !finns(slut) && v === forhand);
        knapp.classList.toggle('ar-kort', forKort);
        knapp.classList.toggle('ar-idag', v === forst);
        knapp.setAttribute('aria-pressed', String(v === start || v === slut));
        if (forKort) knapp.setAttribute('aria-disabled', 'true');
        else knapp.removeAttribute('aria-disabled');
        if (v === forst) knapp.setAttribute('aria-current', 'date');
        knapp.tabIndex = v === fokusdag ? 0 : -1;
      });
      /* Någon dag ska alltid gå att nå med tabb, även efter bläddring. */
      if (!hitta('.dag[tabindex="0"]', manader)) {
        const valbar = hitta('.dag:not(:disabled)', manader);
        if (valbar) valbar.tabIndex = 0;
      }
      Object.entries(knappar).forEach(([namn, knapp]) => knapp.classList.toggle('ar-aktiv', !kalender.hidden && namn === lage));
      visaTips();
    };

    const rita = () => {
      const antal = antalManader();
      visad = Math.max(forstaManad, Math.min(visad, sistaManad - antal + 1));
      manader.replaceChildren(...Array.from({ length: antal }, (_, nr) => ritaManad(visad + nr)));
      blad[-1].setAttribute('aria-disabled', String(visad <= forstaManad));
      blad[1].setAttribute('aria-disabled', String(visad + antal - 1 >= sistaManad));
      markera();
    };

    /* Flyttar fokus till en dag och bläddrar dit om månaden inte syns. */
    const fokusera = (v) => {
      fokusdag = Math.min(sist, Math.max(forst, v));
      const m = manadFor(fokusdag);
      if (m < visad || m > visad + antalManader() - 1) {
        visad = m < visad ? m : m - antalManader() + 1;
        rita();
      } else {
        markera();
      }
      const knapp = hitta(`[data-dag="${somText(fokusdag)}"]`, manader);
      if (knapp) knapp.focus();
    };

    /* Skriver datumen till formulärets fält och till knapparna. */
    const skriv = (lasUpp) => {
      inn.value = finns(start) ? somText(start) : '';
      ut.value = finns(slut) ? somText(slut) : '';
      [
        ['start', start],
        ['slut', slut],
      ].forEach(([namn, v]) => {
        hitta('[data-datum-varde]', knappar[namn]).textContent = finns(v) ? kort(v) : tomt;
        knappar[namn].classList.toggle('ar-tom', !finns(v));
      });
      uppdatera(lasUpp);
    };

    const stang = (aterFokus) => {
      if (kalender.hidden) return;
      kalender.hidden = true;
      forhand = NaN;
      Object.values(knappar).forEach((knapp) => {
        knapp.setAttribute('aria-expanded', 'false');
        knapp.classList.remove('ar-aktiv');
      });
      if (aterFokus && oppnare) oppnare.focus({ preventScroll: true });
    };

    /* Rullar så att hela kalendern syns, men aldrig så långt att datumfälten
       hamnar under sidhuvudet. */
    const synliggor = () => {
      const huvud = topp ? Math.max(0, topp.getBoundingClientRect().bottom) : 0;
      const over = datum.getBoundingClientRect().top - huvud - 12;
      const under = kalender.getBoundingClientRect().bottom - window.innerHeight + 12;
      const flytt = over < 0 ? over : Math.min(over, Math.max(0, under));
      if (Math.abs(flytt) > 1) window.scrollBy({ top: flytt });
    };

    const oppna = (onskat, knapp) => {
      lage = onskat === 'slut' && finns(start) ? 'slut' : 'start';
      oppnare = knapp || knappar[lage];
      const mal = lage === 'slut' ? (finns(slut) ? slut : start + MINST) : finns(start) ? start : forst;
      fokusdag = Math.min(sist, Math.max(forst, mal));
      /* Visa månaden där vistelsen börjar, men alltid den dag som får fokus. */
      visad = manadFor(finns(start) ? start : fokusdag);
      if (manadFor(fokusdag) > visad + antalManader() - 1) visad = manadFor(fokusdag) - antalManader() + 1;
      kalender.hidden = false;
      Object.values(knappar).forEach((k) => k.setAttribute('aria-expanded', 'true'));
      rita();
      synliggor();
      const dag = hitta(`[data-dag="${somText(fokusdag)}"]`, manader);
      if (dag) dag.focus({ preventScroll: true });
    };

    const valj = (v) => {
      if (lage === 'slut' && finns(start) && v > start) {
        if (v - start < MINST) {
          visaTips(t.felMinst);
          return;
        }
        slut = v;
        skriv(true);
        oppnare = knappar.slut;
        stang(true);
        return;
      }
      /* Ny incheckning. Så sent att ingen utcheckning ryms går inte att välja. */
      if (v > sist - MINST) return;
      start = v;
      if (finns(slut) && slut - start < MINST) slut = NaN;
      lage = 'slut';
      forhand = NaN;
      fokusdag = v;
      skriv(true);
      markera();
    };

    manader.addEventListener('click', (h) => {
      const knapp = h.target.closest('.dag');
      if (knapp && !knapp.disabled) valj(somTal(knapp.dataset.dag));
    });

    /* Medan utcheckningen väljs: visa hur lång vistelsen blir. */
    const forhandsvisa = (h) => {
      const knapp = h.target.closest('.dag');
      const v = knapp && !knapp.disabled ? somTal(knapp.dataset.dag) : NaN;
      const ny = lage === 'slut' && finns(start) && !finns(slut) && v - start >= MINST ? v : NaN;
      const flyttat = h.type === 'focusin' && finns(v) && v !== fokusdag;
      if (flyttat) fokusdag = v;
      if (flyttat || (ny !== forhand && (finns(ny) || finns(forhand)))) {
        forhand = ny;
        markera();
      }
    };
    manader.addEventListener('pointerover', forhandsvisa);
    manader.addEventListener('focusin', forhandsvisa);
    manader.addEventListener('pointerleave', () => {
      if (finns(forhand)) {
        forhand = NaN;
        markera();
      }
    });

    datum.addEventListener('keydown', (h) => {
      if (h.key === 'Escape' && !kalender.hidden) {
        h.preventDefault();
        stang(true);
        return;
      }
      const knapp = h.target.closest('.dag');
      if (!knapp) return;
      const v = somTal(knapp.dataset.dag);
      const steg = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[h.key];
      let ny;
      if (steg) {
        ny = v + steg * DYGN;
      } else if (h.key === 'Home') {
        ny = v - veckodag(v) * DYGN;
      } else if (h.key === 'End') {
        ny = v + (6 - veckodag(v)) * DYGN;
      } else if (h.key === 'PageUp' || h.key === 'PageDown') {
        /* Samma dag i månaden före eller efter; med skift ett helt år. */
        const m = manadFor(v) + (h.key === 'PageDown' ? 1 : -1) * (h.shiftKey ? 12 : 1);
        const sistaDagen = new Date(Date.UTC(Math.floor(m / 12), (m % 12) + 1, 0)).getUTCDate();
        ny = Date.UTC(Math.floor(m / 12), m % 12, Math.min(new Date(v).getUTCDate(), sistaDagen));
      } else {
        return;
      }
      h.preventDefault();
      fokusera(ny);
    });

    Object.entries(blad).forEach(([steg, knapp]) => {
      knapp.addEventListener('click', () => {
        if (knapp.getAttribute('aria-disabled') === 'true') return;
        visad += Number(steg);
        rita();
      });
    });
    hitta('[data-kal-rensa]', kalender).addEventListener('click', () => {
      start = NaN;
      slut = NaN;
      lage = 'start';
      forhand = NaN;
      skriv(true);
      markera();
    });
    hitta('[data-kal-klar]', kalender).addEventListener('click', () => stang(true));

    Object.entries(knappar).forEach(([namn, knapp]) => {
      knapp.addEventListener('click', () => {
        const onskat = namn === 'slut' && finns(start) ? 'slut' : 'start';
        /* Ett klick till på samma knapp stänger kalendern. */
        if (!kalender.hidden && oppnare === knapp && lage === onskat) stang(false);
        else oppna(namn, knapp);
      });
    });
    /* Stäng när besökaren klickar eller tabbar vidare till något annat. */
    d.addEventListener('pointerdown', (h) => {
      if (!kalender.hidden && !datum.contains(h.target)) stang(false);
    });
    datum.addEventListener('focusout', (h) => {
      if (!kalender.hidden && h.relatedTarget && !datum.contains(h.relatedTarget)) stang(false);
    });
    bred.addEventListener('change', () => {
      if (!kalender.hidden) rita();
    });

    /* Gäster och förslag på rum. Sällskapet kan dela tvåbäddsrum eller ha eget rum var.
       Ryms det inte i vandrarhemmet blir det en offertförfrågan. */
    const rum = info.rum;
    const baddar = rum.enkel.antal + 2 * rum.dubbel.antal;
    const antalRum = rum.enkel.antal + rum.dubbel.antal;
    const flestGaster = Number(gaster.max) || 500;
    const svar = hitta('[data-bokning-svar]', formular);
    const fel = hitta('[data-bokning-fel]', svar);
    const ett = hitta('[data-forslag-ett]', svar);
    const valruta = hitta('[data-forslag-val]', svar);
    const stort = hitta('[data-forslag-stort]', svar);
    const flera = hitta('[data-forslag-flera]', svar);
    const offertlank = hitta('[data-forslag-offert]', svar);
    const offertnot = hitta('[data-forslag-offertnot]', svar);
    const las = hitta('[data-forslag-las]', svar);
    const stegknappar = hittaAlla('[data-gaster-steg]', formular);
    const bokaknapp = hitta('.bokning__knapp', formular);
    const knapptext = hitta('[data-bokning-knapptext]', bokaknapp);
    const knapptexter = { boka: knapptext.textContent, offert: knapptext.dataset.offert };
    let rumsval = 'dela';
    let mal = { gaster: 1, forfragan: false }; /* vart knappen leder */

    const antalGaster = () => {
      const n = Math.floor(Number(gaster.value));
      return Number.isFinite(n) && n >= 1 ? Math.min(n, flestGaster) : 1;
    };
    const forslagFor = (n) => {
      const delade = Math.min(rum.dubbel.antal, Math.floor(n / 2));
      const egna = Math.min(rum.enkel.antal, n);
      return {
        dela: n <= baddar ? { enkel: n - 2 * delade, dubbel: delade } : null,
        /* Räcker inte enkelrummen får resten var sitt tvåbäddsrum. */
        eget: n <= antalRum ? { enkel: egna, dubbel: n - egna } : null,
      };
    };
    const rumstext = (f) =>
      [
        [f.dubbel, t.antalDubbel],
        [f.enkel, t.antalEnkel],
      ]
        .filter(([antal]) => antal)
        .map(([antal, text]) => antalText(text, antal))
        .join(' + ');
    /* Samma uträkning som Stay72: varje rum för sig, avrundat till hela kronor. */
    const pristext = (f, natter) => {
      if (!natter) return t.perNatt.replace('{pris}', tal.format(f.enkel * rum.enkel.pris + f.dubbel * rum.dubbel.pris));
      const rabatt = natter >= info.rabattFran;
      const perRum = (pris) => Math.round((natter * pris * (rabatt ? 100 - info.rabatt : 100)) / 100);
      return (rabatt ? t.vistelseRabatt : t.vistelse)
        .replace('{natter}', antalText(t.natter, natter))
        .replace('{pris}', tal.format(f.enkel * perRum(rum.enkel.pris) + f.dubbel * perRum(rum.dubbel.pris)));
    };
    const adress = (antal, ankare) =>
      `${info.stay72}?check_in_date=${somText(start)}&check_out_date=${somText(slut)}&guests=${antal}${ankare || ''}`;

    uppdatera = (lasUpp) => {
      const n = antalGaster();
      const natter = finns(start) && finns(slut) ? (slut - start) / DYGN : 0;
      const { dela, eget } = forslagFor(n);
      const tva = !!dela && !!eget && (dela.enkel !== eget.enkel || dela.dubbel !== eget.dubbel);
      const valt = tva ? (rumsval === 'eget' ? eget : dela) : dela || eget;
      const fyll = (rot, f) => {
        hitta('[data-forslag-rum]', rot).textContent = rumstext(f);
        hitta('[data-forslag-pris]', rot).textContent = pristext(f, natter);
      };

      ett.hidden = tva || !valt;
      if (!ett.hidden) fyll(ett, valt);
      valruta.hidden = !tva;
      if (tva) {
        hittaAlla('[data-forslag-id]', valruta).forEach((rad) => {
          const id = rad.dataset.forslagId;
          fyll(rad, id === 'eget' ? eget : dela);
          hitta('input', rad).checked = id === rumsval;
          rad.classList.toggle('ar-vald', id === rumsval);
        });
      }

      const fleraRum = !!valt && valt.enkel + valt.dubbel > 1;
      stort.hidden = !!valt;
      offertnot.hidden = !!valt;
      flera.hidden = !fleraRum;
      /* Stay72 tar emot en förfrågan först när inget enskilt rum rymmer sällskapet: tre eller fler. */
      offertlank.hidden = !(fleraRum && n >= 3);
      offertlank.href = natter ? adress(n, '#forfragan-general') : info.stay72;

      /* Ett rum: sök med antalet gäster. Flera rum bokas ett i taget: tvåbäddsrum om
         alla ska dela, annars alla rum. Ryms sällskapet inte: förfrågan med hela antalet. */
      mal = valt ? { gaster: valt.enkel ? 1 : 2, forfragan: false } : { gaster: n, forfragan: true };
      knapptext.textContent = valt ? knapptexter.boka : knapptexter.offert;
      stegknappar.forEach((knapp) => {
        const steg = Number(knapp.dataset.gasterSteg);
        knapp.setAttribute('aria-disabled', String(steg < 0 ? n <= 1 : n >= flestGaster));
      });
      if (natter) visa(fel, '');

      const upplast = valt ? `${rumstext(valt)}, ${pristext(valt, natter)}` : stort.textContent;
      if (lasUpp && las.textContent !== upplast) las.textContent = upplast;
    };

    gaster.addEventListener('input', () => uppdatera(true));
    gaster.addEventListener('change', () => {
      gaster.value = antalGaster();
      uppdatera(true);
    });
    stegknappar.forEach((knapp) => {
      knapp.addEventListener('click', () => {
        gaster.value = Math.min(flestGaster, Math.max(1, antalGaster() + Number(knapp.dataset.gasterSteg)));
        uppdatera(true);
      });
    });
    valruta.addEventListener('change', (h) => {
      rumsval = h.target.value;
      uppdatera(true);
    });

    /* Utan datum går det inte att söka: säg det och öppna kalendern. Kalendern
       ligger över felraden, därför står samma besked också i kalenderns fot. */
    const harDatum = () => {
      if (finns(start) && finns(slut)) return true;
      visa(fel, t.felDatum);
      oppna(finns(start) ? 'slut' : 'start');
      visaTips(t.felDatum);
      return false;
    };
    formular.addEventListener('submit', (h) => {
      h.preventDefault();
      if (harDatum()) window.location.assign(adress(mal.gaster, mal.forfragan ? '#forfragan-general' : ''));
    });
    offertlank.addEventListener('click', (h) => {
      if (!harDatum()) h.preventDefault();
    });

    /* «Boka enkelrum» och «Boka tvåbäddsrum» väljer antal gäster åt besökaren. */
    hittaAlla('[data-boka-gaster]').forEach((lank) => {
      lank.addEventListener('click', () => {
        gaster.value = lank.dataset.bokaGaster;
        rumsval = 'dela';
        uppdatera(true);
        /* När sidan har rullat färdigt upp till rutan: öppna kalendern om datum saknas. */
        let forra = window.scrollY;
        let stilla = 0;
        let varv = 0;
        const vanta = () => {
          varv += 1;
          stilla = window.scrollY === forra ? stilla + 1 : 0;
          forra = window.scrollY;
          if (stilla < 2 && varv < 30) {
            window.setTimeout(vanta, 80);
          } else if (finns(start) && finns(slut)) {
            bokaknapp.focus({ preventScroll: true });
          } else {
            oppna(finns(start) ? 'slut' : 'start');
          }
        };
        window.setTimeout(vanta, 80);
      });
    });

    /* Läser fälten, också när besökaren backar hit från bokningssidan och de redan är ifyllda. */
    const lasIn = () => {
      start = somTal(inn.value);
      slut = somTal(ut.value);
      if (!finns(start) || start < forst || start > sist - MINST) start = NaN;
      if (!finns(start) || !finns(slut) || slut - start < MINST || slut > sist) slut = NaN;
      const markerat = hitta('input:checked', valruta);
      if (markerat) rumsval = markerat.value;
      skriv();
    };

    /* Skriptet tar över: egna datumknappar i stället för webbläsarens fält. */
    formular.noValidate = true;
    hittaAlla('[data-datum-reserv]', datum).forEach((falt) => (falt.hidden = true));
    hitta('[data-datumval]', datum).hidden = false;
    stegknappar.forEach((knapp) => (knapp.hidden = false));
    svar.hidden = false;
    lasIn();
    window.addEventListener('pageshow', () => lasIn());
  }

  /* Bildvisning */
  const ruta = hitta('[data-bildvisning]');
  const poster = hittaAlla('[data-bild]').map((lank) => ({
    id: lank.dataset.bild,
    fil: lank.dataset.full || lank.href,
    text: lank.dataset.text || '',
    alt: (hitta('img', lank) || {}).alt || '',
  }));
  if (ruta && typeof ruta.showModal === 'function' && poster.length) {
    const bild = hitta('[data-bv-bild]', ruta);
    const bildtext = hitta('[data-bv-text]', ruta);
    const raknare = hitta('[data-bv-rakna]', ruta);
    const tomBild = bild.src;
    let nu = 0;
    let oppnare = null;

    const visaBild = (nr) => {
      nu = (nr + poster.length) % poster.length;
      const post = poster[nu];
      bild.src = post.fil;
      bild.alt = post.alt;
      bildtext.textContent = post.text;
      raknare.textContent = (t.raknare || '{nr} / {antal}').replace('{nr}', nu + 1).replace('{antal}', poster.length);
      new Image().src = poster[(nu + 1) % poster.length].fil;
    };

    d.addEventListener('click', (h) => {
      const lank = h.target.closest('[data-bild], [data-visa-bild]');
      if (!lank || h.metaKey || h.ctrlKey || h.shiftKey || h.button) return;
      const nr = poster.findIndex((p) => p.id === (lank.dataset.bild || lank.dataset.visaBild));
      if (nr < 0) return;
      h.preventDefault();
      oppnare = lank;
      visaBild(nr);
      ruta.showModal();
    });

    hitta('[data-bv-forra]', ruta).addEventListener('click', () => visaBild(nu - 1));
    hitta('[data-bv-nasta]', ruta).addEventListener('click', () => visaBild(nu + 1));
    hitta('[data-bv-stang]', ruta).addEventListener('click', () => ruta.close());
    ruta.addEventListener('keydown', (h) => {
      if (h.key === 'ArrowLeft') visaBild(nu - 1);
      if (h.key === 'ArrowRight') visaBild(nu + 1);
    });
    /* Klick utanför bilden stänger. */
    ruta.addEventListener('click', (h) => {
      if (h.target === ruta || h.target.classList.contains('bildvisning__figur')) ruta.close();
    });
    ruta.addEventListener('close', () => {
      bild.src = tomBild;
      if (oppnare) oppnare.focus({ preventScroll: true });
    });

    let startX = null;
    ruta.addEventListener('touchstart', (h) => (startX = h.touches[0].clientX), { passive: true });
    ruta.addEventListener(
      'touchend',
      (h) => {
        if (startX === null) return;
        const flytt = h.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(flytt) > 50) visaBild(nu + (flytt < 0 ? 1 : -1));
      },
      { passive: true },
    );
  }

  /* Kartan hämtas först när besökaren ber om den. */
  const karta = hitta('[data-karta]');
  const kartknapp = karta && hitta('[data-karta-knapp]', karta);
  if (kartknapp) {
    kartknapp.addEventListener('click', () => {
      const ram = d.createElement('iframe');
      ram.src = karta.dataset.src;
      ram.title = karta.dataset.titel;
      ram.referrerPolicy = 'no-referrer';
      hitta('.karta__val', karta).hidden = true;
      karta.classList.add('ar-hamtad');
      karta.appendChild(ram);
      ram.focus();
    });
  }

  /* Hur långt är det till jobbet? Adressen slås upp hos OpenStreetMap när besökaren
     ber om det, och avståndet räknas fågelvägen. Utan skript öppnar formuläret
     resvägen i Google Maps i stället. */
  const avstand = hitta('[data-avstand]');
  const at = t.avstand;
  if (avstand && at && info.plats) {
    const formular = hitta('form', avstand);
    const falt = formular.elements.destination;
    const knapp = hitta('button[type="submit"]', formular);
    const svar = hitta('[data-avstand-svar]', avstand);
    const grader = (v) => (v * Math.PI) / 180;
    const kilometer = (a, b) => {
      const h =
        Math.sin(grader(b.lat - a.lat) / 2) ** 2 +
        Math.cos(grader(a.lat)) * Math.cos(grader(b.lat)) * Math.sin(grader(b.lon - a.lon) / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(h));
    };
    const somStracka = (km) => {
      if (km < 1) return at.meter.replace('{n}', Math.max(50, Math.round(km * 20) * 50));
      const decimaler = km < 20 ? 1 : 0;
      const tal = new Intl.NumberFormat(info.talformat, { maximumFractionDigits: decimaler });
      return at.km.replace('{n}', tal.format(km));
    };
    const resvag = (mal) =>
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(info.adress)}&destination=${encodeURIComponent(mal)}`;
    const visa = (text, mal, fel) => {
      const rad = d.createElement('p');
      rad.textContent = text;
      if (fel) rad.className = 'avstand__fel';
      svar.replaceChildren(rad);
      if (mal) {
        const lank = d.createElement('a');
        lank.className = 'knapp knapp--kant knapp--liten';
        lank.href = resvag(mal);
        lank.target = '_blank';
        lank.rel = 'noopener';
        lank.textContent = at.vag;
        svar.append(lank);
      }
      svar.hidden = false;
    };
    const visaAvstand = (plats, punkt, mal) =>
      visa(at.resultat.replace('{avstand}', somStracka(kilometer(info.plats, punkt))).replace('{plats}', plats), mal);

    formular.addEventListener('submit', async (h) => {
      h.preventDefault();
      const fraga = falt.value.trim();
      if (!fraga) return;
      knapp.disabled = true;
      visa(at.soker);
      try {
        const adress =
          'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&addressdetails=1' +
          `&accept-language=${encodeURIComponent(info.sprak)}&q=${encodeURIComponent(fraga)}`;
        const hamtat = await fetch(adress, { headers: { Accept: 'application/json' } });
        if (!hamtat.ok) throw new Error(String(hamtat.status));
        const [traff] = await hamtat.json();
        if (!traff) {
          visa(at.felHittas, fraga, true);
        } else {
          /* Visa vad uppslaget faktiskt träffade: «Storgatan 1, Kumla» eller «Kumla». */
          const del = traff.address || {};
          const ort = del.city || del.town || del.village || del.hamlet || del.municipality || '';
          const gata = del.road ? [del.road, del.house_number].filter(Boolean).join(' ') : '';
          const forst = traff.name && traff.name !== del.road ? traff.name : gata || traff.name || fraga;
          const namn = [forst, ort].filter((bit, nr, alla) => bit && alla.indexOf(bit) === nr).join(', ');
          visaAvstand(namn, { lat: Number(traff.lat), lon: Number(traff.lon) }, fraga);
        }
      } catch {
        visa(at.felTeknik, fraga, true);
      }
      knapp.disabled = false;
    });

    const stationsknapp = hitta('[data-avstand-station]', avstand);
    if (stationsknapp && info.station) {
      stationsknapp.addEventListener('click', () => {
        falt.value = at.station;
        visaAvstand(at.station, info.station, `${at.station}, Hallsberg`);
      });
    }
  }

  /* Listan över alla rum hämtas från Stay72 först när den fälls ut. */
  const allaRum = hitta('[data-alla-rum]');
  if (allaRum && info.stay72Skript) {
    allaRum.addEventListener('toggle', () => {
      if (!allaRum.open || allaRum.dataset.hamtad) return;
      allaRum.dataset.hamtad = 'ja';
      const skript = d.createElement('script');
      skript.src = info.stay72Skript;
      skript.async = true;
      skript.setAttribute('data-stay72-page', info.stay72);
      skript.setAttribute('data-view', 'objects');
      skript.setAttribute('data-title', t.allaTitel || '');
      hitta('[data-alla-rum-plats]', allaRum).appendChild(skript);
    });
  }
})();
