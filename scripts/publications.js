// Shared by the browser and the static publication-list generator.
(function (root) {
  function createPublicationRenderer(document, DOMParser) {
    const list = document.getElementById('dblp-publications');
    const profileUrl = 'https://dblp.org/pid/395/6483';
    // Verified recordings and seminar pages. Keep this small, explicit index rather than
    // relying on a third-party search endpoint that browsers commonly block with CORS.
    const talksByTitle = {
      'the complexity of unpredictability': [{
        url: 'https://simons.berkeley.edu/talks/aryan-agarwala-max-planck-institute-informatics-2026-10-27',
        speaker: 'Aryan Agarwala'
      }],
      'linear matroid intersection is in catalytic logspace': [{
        url: 'https://youtu.be/O1MoqXD7Icg',
        speaker: 'Aryan Agarwala'
      }],
      'pseudodeterministic algorithms for minimum cut problems': [{
        url: 'https://youtu.be/bwZi6TNAyvw',
        speaker: 'Aryan Agarwala'
      }],
      'bipartite matching is in catalytic logspace': [{
        url: 'https://youtu.be/8nUpLv4t28I',
        speaker: 'Ian Mertz'
      }]
    };
    // Papers not yet indexed by DBLP; merge into both cached and live responses.
    const supplementalPublications = [{
      title: 'The Complexity of Unpredictability',
      authors: { author: ['Aryan Agarwala', 'Dani Dorfman'] },
      year: '2026',
      venue: 'CoRR',
      type: 'Informal Publications',
      ee: 'https://arxiv.org/abs/2611.05956'
    }];
    // Exact publication dates break ties within a year, including after DBLP indexing.
    const publicationDatesByTitle = {
      'the complexity of unpredictability': '2026-11-04'
    };
    function cleanText(value) {
      if (value == null) return '';
      const parser = new DOMParser();
      const doc = parser.parseFromString('<html><body><div>' + String(value) + '</div></body></html>', 'text/html');
      return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function asArray(value) {
      if (value == null) return [];
      return Array.isArray(value) ? value : [value];
    }

    function objectText(value) {
      if (typeof value === 'string') return cleanText(value);
      if (!value || typeof value !== 'object') return '';
      return cleanText(value.text || value.url || value.value || value.href || '');
    }

    function recordsFromPayload(payload) {
      if (!payload || typeof payload !== 'object' ||
          !payload.result || typeof payload.result !== 'object' ||
          !payload.result.hits || typeof payload.result.hits !== 'object') {
        return null;
      }

      const rawHits = payload.result.hits.hit;
      const hits = rawHits == null ? [] : (Array.isArray(rawHits) ? rawHits : [rawHits]);
      if (!hits.length || hits.length > 2000) return null;

      const records = [];
      for (let index = 0; index < hits.length; index += 1) {
        const hit = hits[index];
        const record = hit && hit.info;
        if (!record || typeof record !== 'object' || !cleanText(record.title)) return null;

        const year = cleanText(record.year);
        if (year && !/^\d{4}$/.test(year)) return null;

        const authors = asArray(record.authors && record.authors.author);
        const editions = asArray(record.ee);
        if (authors.length > 100 || editions.length > 20) return null;
        records.push(record);
      }
      return records;
    }

    function cleanAuthorName(name) {
      return cleanText(name)
        // dblp appends a four-digit disambiguation suffix to homonymous authors.
        .replace(/\s+\d{4}$/u, '')
        .trim();
    }

    function authorName(author) {
      if (typeof author === 'string') return cleanAuthorName(author);
      if (!author || typeof author !== 'object') return '';
      return cleanAuthorName(author.text || author.name || author.value || '');
    }

    function authorsFor(record) {
      return asArray(record.authors && record.authors.author)
        .map(authorName)
        .filter(Boolean);
    }

    function normalizeTitle(value) {
      return cleanText(value)
        .replace(/\.$/, '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\b(?:extended|full|conference|journal|preliminary)\s+version\b/g, ' ')
        .replace(/\bextended\s+abstract\b/g, ' ')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function tokenSet(title) {
      return new Set(normalizeTitle(title).split(' ').filter(Boolean));
    }

    function jaccard(left, right) {
      if (!left.size || !right.size) return 0;
      let intersection = 0;
      left.forEach(function (token) {
        if (right.has(token)) intersection += 1;
      });
      return intersection / (left.size + right.size - intersection);
    }

    function normalizedAuthorSet(record) {
      return new Set(authorsFor(record).map(function (name) {
        return name
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      }).filter(Boolean));
    }

    function overlapCoefficient(left, right) {
      if (!left.size || !right.size) return 0;
      let intersection = 0;
      left.forEach(function (value) {
        if (right.has(value)) intersection += 1;
      });
      return intersection / Math.min(left.size, right.size);
    }

    function samePaper(left, right) {
      const leftTitle = normalizeTitle(left.title);
      const rightTitle = normalizeTitle(right.title);
      if (!leftTitle || !rightTitle) return false;
      if (leftTitle === rightTitle) return true;

      const leftTokens = tokenSet(left.title);
      const rightTokens = tokenSet(right.title);
      if (Math.min(leftTokens.size, rightTokens.size) < 5) return false;

      const titleSimilarity = jaccard(leftTokens, rightTokens);
      const authorSimilarity = overlapCoefficient(
        normalizedAuthorSet(left),
        normalizedAuthorSet(right)
      );
      const leftYear = Number(left.year || 0);
      const rightYear = Number(right.year || 0);
      const closeInTime = !leftYear || !rightYear || Math.abs(leftYear - rightYear) <= 3;
      const containment = leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle);
      const lengthRatio = Math.min(leftTitle.length, rightTitle.length) /
        Math.max(leftTitle.length, rightTitle.length);

      return closeInTime && authorSimilarity >= 0.8 && (
        titleSimilarity >= 0.88 ||
        (containment && lengthRatio >= 0.82)
      );
    }

    function isPreprint(record) {
      const venue = cleanText(record.venue).toLowerCase();
      const type = cleanText(record.type).toLowerCase();
      const urls = asArray(record.ee).map(objectText).join(' ').toLowerCase();
      return venue === 'corr' || type.includes('informal') || urls.includes('arxiv');
    }

    function recordPriority(record) {
      let score = 0;
      if (!isPreprint(record)) score += 100;
      if (cleanText(record.venue)) score += 20;
      if (asArray(record.ee).length) score += 10;
      score += Number(record.year || 0) / 10000;
      return score;
    }

    function groupRecords(records) {
      const groups = [];

      records.forEach(function (record) {
        let matchingGroup = null;
        for (let index = 0; index < groups.length; index += 1) {
          if (groups[index].records.some(function (candidate) {
            return samePaper(record, candidate);
          })) {
            matchingGroup = groups[index];
            break;
          }
        }

        if (matchingGroup) {
          matchingGroup.records.push(record);
        } else {
          groups.push({ records: [record] });
        }
      });

      groups.forEach(function (group) {
        group.records.sort(function (a, b) {
          return recordPriority(b) - recordPriority(a);
        });
        group.display = group.records[0];
        group.year = Math.max.apply(null, group.records.map(function (record) {
          return Number(record.year || 0);
        }));
      });

      groups.sort(function (a, b) {
        const yearDifference = b.year - a.year;
        if (yearDifference) return yearDifference;
        const dateFor = function (group) {
          return publicationDatesByTitle[normalizeTitle(group.display.title)] || group.year + '-01-01';
        };
        const dateDifference = dateFor(b).localeCompare(dateFor(a));
        if (dateDifference) return dateDifference;
        return normalizeTitle(a.display.title).localeCompare(normalizeTitle(b.display.title));
      });

      return groups;
    }

    function versionLabel(record) {
      const venue = cleanText(record.venue);
      const type = cleanText(record.type);
      const year = cleanText(record.year);
      let label = venue || type || 'Publication';
      if (isPreprint(record) && (!venue || venue.toLowerCase() === 'corr')) {
        label = 'Preprint';
      }
      return [label, year].filter(Boolean).join(' ');
    }

    function linkUrl(value) {
      return objectText(value);
    }

    function classifyLink(url) {
      try {
        const parsed = new URL(url, profileUrl);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        const path = (parsed.pathname + parsed.search).toLowerCase();

        if (host === 'dblp.org') return 'DBLP';
        if (host.includes('arxiv.org') || path.includes('10.48550/arxiv')) return 'arXiv';
        if (host === 'doi.org' || host === 'dx.doi.org') return 'DOI';
        if (host.includes('ieeexplore.ieee.org')) return 'IEEE';
        if (host.includes('eccc')) return 'ECCC';
        if (host.includes('dl.acm.org')) return 'ACM DL';
        if (host.includes('drops.dagstuhl.de')) return 'DROPS';
        if (host.includes('springer.com')) return 'Springer';
        if (host.includes('siam.org')) return 'SIAM';
        if (host.includes('eprint.iacr.org')) return 'IACR ePrint';
        if (host.includes('theoryofcomputing.org')) return 'ToC';
        return host.split('.')[0].replace(/(^|[-_])\w/g, function (match) {
          return match.replace(/[-_]/, '').toUpperCase();
        }) || 'Source';
      } catch (error) {
        return 'Source';
      }
    }

    function linksFor(record) {
      const links = [];
      const seen = new Set();

      function add(url, preferredLabel) {
        const cleanUrl = linkUrl(url);
        if (!/^https?:\/\//i.test(cleanUrl) || seen.has(cleanUrl)) return;
        seen.add(cleanUrl);
        links.push({
          url: cleanUrl,
          label: preferredLabel || classifyLink(cleanUrl)
        });
      }

      add(record.url, 'DBLP');
      asArray(record.ee).forEach(function (url) { add(url); });
      return links;
    }

    function talkVenue(url) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        const names = {
          'youtube.com': 'YouTube',
          'youtu.be': 'YouTube',
          'vimeo.com': 'Vimeo',
          'slideslive.com': 'SlidesLive',
          'zoom.us': 'Zoom'
        };
        return names[host] || host.split('.').slice(0, -1).join('.') || host;
      } catch (error) {
        return 'Online';
      }
    }

    function venueFor(url, text) {
      const details = cleanText(text);
      const labelled = details.match(/(?:venue|location)\s*[:\-]\s*([^.|;]+)/i);
      if (labelled && labelled[1]) return labelled[1].trim();
      const city = details.match(/\b(Lisbon|Saarbrücken|Dagstuhl|Vancouver|Sydney)\b/i);
      if (city) return city[1];
      const event = details.match(/\b(ITCS|FOCS|STOC|ICALP|MFCS|SODA|ESA)\b/i);
      if (event) return event[1].toUpperCase();
      return talkVenue(url);
    }

    function addTalkLinks(record, container) {
      const key = normalizeTitle(record.title);
      const talks = talksByTitle[key] || [];
      talks.forEach(function (talk) {
        const link = document.createElement('a');
        link.className = 'pub-talk';
        link.href = talk.url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = 'Talk by ' + talk.speaker;
        link.setAttribute('aria-label', 'Open talk by ' + talk.speaker);
        container.appendChild(link);
      });
    }

    function venueSummary(group) {
      const labels = [];
      const seen = new Set();
      group.records.forEach(function (record) {
        const label = versionLabel(record);
        if (label && !seen.has(label)) {
          seen.add(label);
          labels.push(label);
        }
      });
      return labels.join(' · ');
    }

    function renderVersion(record) {
      const row = document.createElement('div');
      row.className = 'pub-version';

      const label = document.createElement('span');
      label.className = 'pub-version-label';
      label.textContent = versionLabel(record);
      row.appendChild(label);

      const links = linksFor(record);
      if (links.length) {
        const linksContainer = document.createElement('span');
        linksContainer.className = 'pub-links';
        links.forEach(function (linkInfo) {
          const link = document.createElement('a');
          link.href = linkInfo.url;
          link.target = '_blank';
          link.rel = 'noreferrer';
          link.textContent = linkInfo.label;
          linksContainer.appendChild(link);
        });
        row.appendChild(linksContainer);
      }

      return row;
    }

    function render(payload) {
      const records = recordsFromPayload(payload);
      if (!records) throw new Error('dblp returned invalid publication data');
      supplementalPublications.forEach(function (supplement) {
        const alreadyIndexed = records.some(function (record) {
          return samePaper(record, supplement) && isPreprint(record);
        });
        if (!alreadyIndexed) records.push(supplement);
      });
      const groups = groupRecords(records);

      const fragment = document.createDocumentFragment();

      if (!records.length || !groups.length) {
        throw new Error('dblp returned no publications');
      }

      groups.forEach(function (group) {
        const record = group.display;
        const item = document.createElement('li');
        const title = cleanText(record.title).replace(/\.$/, '');
        const authors = authorsFor(record);

        const venueLine = document.createElement('span');
        venueLine.className = 'pub-venue';
        venueLine.textContent = venueSummary(group);

        const titleLine = document.createElement('div');
        titleLine.className = 'pub-title';
        const primaryLinks = linksFor(record);
        const primaryUrl = (primaryLinks[1] && primaryLinks[1].url) ||
          (primaryLinks[0] && primaryLinks[0].url) || profileUrl;
        const titleLink = document.createElement('a');
        titleLink.href = primaryUrl;
        titleLink.target = '_blank';
        titleLink.rel = 'noreferrer';
        titleLink.textContent = title || 'Untitled publication';
        titleLine.appendChild(titleLink);

        const authorLine = document.createElement('div');
        authorLine.className = 'pub-authors';
        authorLine.textContent = authors.join(', ');

        const versions = document.createElement('div');
        versions.className = 'pub-versions';
        group.records.forEach(function (version) {
          versions.appendChild(renderVersion(version));
        });

        const talks = document.createElement('div');
        talks.className = 'pub-talks';
        addTalkLinks(record, talks);

        item.appendChild(venueLine);
        item.appendChild(titleLine);
        if (authors.length) item.appendChild(authorLine);
        item.appendChild(versions);
        item.appendChild(talks);
        fragment.appendChild(item);
      });

      list.replaceChildren(fragment);
      list.setAttribute('aria-busy', 'false');
    }

    return { render, recordsFromPayload };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createPublicationRenderer;
  } else {
    root.createPublicationRenderer = createPublicationRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
