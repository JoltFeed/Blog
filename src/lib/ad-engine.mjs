/**
 * JoltFeed Deterministic Ad Placement Engine
 * Supports all 9 placements:
 *  - before_title
 *  - after_title
 *  - before_first_paragraph
 *  - before_paragraph (N)
 *  - after_paragraph (N)
 *  - every_n_paragraphs (interval, start N, maxRepeats)
 *  - percentage (25%, 50%, 75%, or custom % of body words)
 *  - after_post
 *  - manual (Ad slot blocks in editor)
 *
 * Strictly counts ONLY nonempty, top-level body paragraphs.
 * Headings, lists, captions, quotes, images, videos, and embeds NEVER shift paragraph numbering.
 */

export function countWords(text) {
  const cleaned = String(text || "").replace(/<[^>]*>/g, " ").trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

export function evaluateAdPlacements(post, ads, settings, viewport = "desktop") {
  const blocks = Array.isArray(post.blocks) ? post.blocks : [];
  const paragraphIndices = [];
  let totalParagraphWords = 0;

  blocks.forEach((blk, idx) => {
    if (blk.type === "paragraph" && String(blk.text || "").trim().length > 0) {
      const words = countWords(blk.text);
      totalParagraphWords += words;
      paragraphIndices.push({
        blockIndex: idx,
        paragraphNumber: paragraphIndices.length + 1,
        words
      });
    }
  });

  const totalParagraphs = paragraphIndices.length;
  const diagnostics = [];
  const maxAds = Number(settings?.maxAdsPerArticle ?? 6);

  if (post.disableAds) {
    for (const ad of ads) {
      diagnostics.push({
        adId: ad.id,
        adName: ad.name,
        placement: ad.placement,
        status: "skipped",
        reason: "Ads are disabled on this post (per-post Disable ads switch is ON)."
      });
    }
    return {
      totalParagraphs,
      totalWords: totalParagraphWords,
      boundaries: {},
      diagnostics,
      placedCount: 0
    };
  }

  const boundaryCandidates = {};
  const proposeBoundary = (boundaryKey, label, ad) => {
    if (!boundaryCandidates[boundaryKey]) boundaryCandidates[boundaryKey] = [];
    boundaryCandidates[boundaryKey].push({
      ad,
      boundaryKey,
      label,
      priority: Number(ad.priority || 0)
    });
  };

  for (const ad of ads) {
    if (!ad.enabled) {
      diagnostics.push({
        adId: ad.id,
        adName: ad.name,
        placement: ad.placement,
        status: "skipped",
        reason: "Rule is disabled in Admin -> Ads."
      });
      continue;
    }

    if (ad.device && ad.device !== "all" && ad.device !== viewport) {
      diagnostics.push({
        adId: ad.id,
        adName: ad.name,
        placement: ad.placement,
        status: "skipped",
        reason: `Device mismatch: rule targets '${ad.device}', active viewport is '${viewport}'.`
      });
      continue;
    }

    const minWords = Number(ad.minWords || 0);
    if (totalParagraphWords < minWords) {
      diagnostics.push({
        adId: ad.id,
        adName: ad.name,
        placement: ad.placement,
        status: "skipped",
        reason: `Post has ${totalParagraphWords} body words, rule requires minimum ${minWords} words.`
      });
      continue;
    }

    switch (ad.placement) {
      case "before_title":
        proposeBoundary("before_title", "Before title", ad);
        break;
      case "after_title":
        proposeBoundary("after_title", "After title (before featured image)", ad);
        break;
      case "after_post":
        proposeBoundary("after_post", "After post (before share links)", ad);
        break;
      case "before_first_paragraph":
        if (totalParagraphs < 1) {
          diagnostics.push({
            adId: ad.id,
            adName: ad.name,
            placement: ad.placement,
            status: "skipped",
            reason: "Post has 0 top-level body paragraphs."
          });
        } else {
          proposeBoundary(`before_block_${paragraphIndices[0].blockIndex}`, "Before first paragraph (P1)", ad);
        }
        break;
      case "before_paragraph": {
        const targetN = Number(ad.paramN || 1);
        if (totalParagraphs < targetN) {
          diagnostics.push({
            adId: ad.id,
            adName: ad.name,
            placement: ad.placement,
            status: "skipped",
            reason: `Post has ${totalParagraphs} paragraphs, rule requires ${targetN}.`
          });
        } else {
          const targetP = paragraphIndices[targetN - 1];
          proposeBoundary(`before_block_${targetP.blockIndex}`, `Before paragraph ${targetN}`, ad);
        }
        break;
      }
      case "after_paragraph": {
        const targetN = Number(ad.paramN || 1);
        if (totalParagraphs < targetN) {
          diagnostics.push({
            adId: ad.id,
            adName: ad.name,
            placement: ad.placement,
            status: "skipped",
            reason: `Post has ${totalParagraphs} paragraphs, rule requires ${targetN}.`
          });
        } else {
          const targetP = paragraphIndices[targetN - 1];
          proposeBoundary(`after_block_${targetP.blockIndex}`, `After paragraph ${targetN}`, ad);
        }
        break;
      }
      case "every_n_paragraphs": {
        const startN = Math.max(1, Number(ad.paramN || 2));
        const interval = Math.max(1, Number(ad.interval || 3));
        const maxRepeats = Math.max(1, Number(ad.maxRepeats || 2));
        if (totalParagraphs < startN) {
          diagnostics.push({
            adId: ad.id,
            adName: ad.name,
            placement: ad.placement,
            status: "skipped",
            reason: `Post has ${totalParagraphs} paragraphs, rule requires ${startN}.`
          });
        } else {
          let count = 0;
          for (let pNum = startN; pNum <= totalParagraphs && count < maxRepeats; pNum += interval) {
            const targetP = paragraphIndices[pNum - 1];
            count++;
            proposeBoundary(
              `after_block_${targetP.blockIndex}`,
              `Every ${interval} paragraphs (After paragraph ${pNum}, repeat ${count}/${maxRepeats})`,
              ad
            );
          }
        }
        break;
      }
      case "percentage": {
        const pct = Math.min(100, Math.max(1, Number(ad.percentage || 50)));
        if (totalParagraphs === 0 || totalParagraphWords === 0) {
          diagnostics.push({
            adId: ad.id,
            adName: ad.name,
            placement: ad.placement,
            status: "skipped",
            reason: `Post has no body words to calculate ${pct}% threshold.`
          });
        } else {
          const threshold = Math.ceil((pct / 100) * totalParagraphWords);
          let cumulative = 0;
          let chosenP = paragraphIndices[paragraphIndices.length - 1];
          for (const pInfo of paragraphIndices) {
            cumulative += pInfo.words;
            if (cumulative >= threshold) {
              chosenP = pInfo;
              break;
            }
          }
          proposeBoundary(
            `after_block_${chosenP.blockIndex}`,
            `${pct}% of article (After paragraph ${chosenP.paragraphNumber})`,
            ad
          );
        }
        break;
      }
      case "manual": {
        let matched = 0;
        blocks.forEach((blk, bIdx) => {
          if (blk.type === "ad_slot" && blk.adId === ad.id) {
            matched++;
            proposeBoundary(`manual_block_${bIdx}`, `Manual Ad Slot (Block #${bIdx + 1})`, ad);
          }
        });
        if (matched === 0) {
          diagnostics.push({
            adId: ad.id,
            adName: ad.name,
            placement: ad.placement,
            status: "skipped",
            reason: "No manual 'Ad slot' block in this post references this unit."
          });
        }
        break;
      }
    }
  }

  // Conflict resolution per boundary: higher priority wins
  const winners = [];
  for (const bKey of Object.keys(boundaryCandidates)) {
    const candidates = boundaryCandidates[bKey];
    candidates.sort((a, b) => b.priority - a.priority);
    const winner = candidates[0];
    winners.push(winner);
    for (let i = 1; i < candidates.length; i++) {
      diagnostics.push({
        adId: candidates[i].ad.id,
        adName: candidates[i].ad.name,
        placement: candidates[i].ad.placement,
        status: "skipped",
        reason: `Superseded at boundary '${winner.label}' by higher-priority rule '${winner.ad.name}' (Priority ${winner.priority} vs ${candidates[i].priority}).`
      });
    }
  }

  winners.sort((a, b) => b.priority - a.priority);
  const boundaries = {};
  let placedCount = 0;

  for (const cand of winners) {
    if (placedCount < maxAds) {
      boundaries[cand.boundaryKey] = cand;
      placedCount++;
      diagnostics.push({
        adId: cand.ad.id,
        adName: cand.ad.name,
        placement: cand.ad.placement,
        status: "placed",
        reason: `Active at: ${cand.label} (Priority ${cand.priority})`
      });
    } else {
      diagnostics.push({
        adId: cand.ad.id,
        adName: cand.ad.name,
        placement: cand.ad.placement,
        status: "skipped",
        reason: `Sitewide max ads per article (${maxAds}) reached.`
      });
    }
  }

  return {
    totalParagraphs,
    totalWords: totalParagraphWords,
    boundaries,
    diagnostics,
    placedCount
  };
}
