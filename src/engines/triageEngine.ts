// triageEngine.ts
export type Confidence = 'Likely' | 'Possible';
export type Risk = 'low' | 'soon';

export interface TriageCause {
  title: string;
  confidence: Confidence;
  risk: Risk;
  explain: string;
  action: string;
}

export interface TriageOption {
  key: string;
  label: string;
}

export interface TriageQuestion {
  text: string;
  options: TriageOption[];
}

export interface TriageAnswers {
  q1: string;
  q2: string;
}

export interface SymptomDefinition {
  icon: string;
  label: string;
  q1: TriageQuestion;
  q2: TriageQuestion;
  resolve: (answers: TriageAnswers) => TriageCause[];
}

export const triageTree: Record<string, SymptomDefinition> = {
  yellowing: {
    icon: '🍃',
    label: 'Yellowing leaves',
    q1: { text: 'Where on the plant?', options: [
      { key: 'lower', label: 'Lower / older leaves' },
      { key: 'upper', label: 'Upper / new leaves' },
      { key: 'whole', label: 'Whole plant' },
    ]},
    q2: { text: 'How has the soil felt lately?', options: [
      { key: 'soggy', label: 'Soggy or waterlogged' },
      { key: 'dry', label: 'Dry, hard to keep moist' },
      { key: 'normal', label: 'Normal, evenly moist' },
    ]},
    resolve(a) {
      const out: TriageCause[] = [];
      if (a.q1 === 'lower' && a.q2 === 'soggy') {
        out.push({ title: 'Overwatering / root stress', confidence: 'Likely', risk: 'soon',
          explain: 'Lower leaves yellow first when roots sit in water and struggle to take up nutrients.',
          action: 'Let the top 2" of soil dry before the next watering, and check drainage at the bottom of the bed.' });
      }
      if (a.q1 === 'lower' && (a.q2 === 'dry' || a.q2 === 'normal')) {
        out.push({ title: 'Nitrogen deficiency', confidence: 'Likely', risk: 'low',
          explain: 'Older leaves yellow and drop when nitrogen is pulled from them to feed new growth.',
          action: 'Work in a balanced organic fertilizer or compost and see if new growth comes in greener.' });
      }
      if (a.q1 === 'upper' || a.q1 === 'whole') {
        out.unshift({ title: 'Nutrient lockup (iron/magnesium)', confidence: 'Possible', risk: 'low',
          explain: 'Yellowing on new growth first, often between the veins, usually means a micronutrient is locked up rather than absent.',
          action: 'Check soil pH. Very high or low pH blocks nutrient uptake even when nutrients are present.' });
      }
      out.push({ title: 'Natural leaf aging', confidence: 'Possible', risk: 'low',
        explain: 'A couple of lower leaves yellowing and dropping over time is often just normal turnover.',
        action: 'If it is only 1-2 leaves and the plant is otherwise vigorous, no action is needed.' });
      return out;
    },
  },
  wilting: {
    icon: '🥀',
    label: 'Wilting',
    q1: { text: 'Does it perk back up by evening or the next morning?', options: [
      { key: 'yes', label: 'Yes, it recovers' },
      { key: 'no', label: 'No, stays wilted' },
    ]},
    q2: { text: 'How does the soil feel right now?', options: [
      { key: 'wet', label: 'Wet or soggy' },
      { key: 'dry', label: 'Dry' },
    ]},
    resolve(a) {
      const out: TriageCause[] = [];
      if (a.q1 === 'yes') {
        out.push({ title: 'Normal heat stress', confidence: 'Likely', risk: 'low',
          explain: 'Midday wilting that bounces back by evening is usually the plant conserving water on a hot day, not damage.',
          action: 'No action needed if it recovers. Water early in the morning so it starts the day hydrated.' });
      }
      if (a.q1 === 'no' && a.q2 === 'wet') {
        out.push({ title: 'Root rot / overwatering', confidence: 'Likely', risk: 'soon',
          explain: 'Wilting that does not recover, combined with wet soil, usually means roots are damaged and cannot move water up.',
          action: 'Hold off watering until the top few inches dry out, and check roots for a soft, dark texture if you can.' });
      }
      if (a.q1 === 'no' && a.q2 === 'dry') {
        out.push({ title: 'Underwatering', confidence: 'Likely', risk: 'soon',
          explain: 'Wilting with dry soil and no recovery is a straightforward sign the plant has run out of accessible water.',
          action: 'Water deeply now, then check your schedule. This bed may need a shorter interval between sessions.' });
      }
      out.push({ title: 'Transplant shock', confidence: 'Possible', risk: 'low',
        explain: 'Recently moved seedlings wilt while their root system reestablishes, even with fine soil moisture.',
        action: 'Keep soil evenly moist and give it 5-7 days before assuming something else is wrong.' });
      return out;
    },
  },
  curling: {
    icon: '🌿',
    label: 'Curling leaves',
    q1: { text: 'Curling upward or downward?', options: [
      { key: 'up', label: 'Upward, cupping' },
      { key: 'down', label: 'Downward' },
    ]},
    q2: { text: 'Any pests visible on the undersides?', options: [
      { key: 'yes', label: 'Yes, I see something' },
      { key: 'no', label: 'No, leaves look clean' },
    ]},
    resolve(a) {
      const out: TriageCause[] = [];
      if (a.q1 === 'up' && a.q2 === 'no') {
        out.push({ title: 'Heat or water-stress curl', confidence: 'Likely', risk: 'low',
          explain: 'Upward cupping with no pests is a common response to heat, wind, or inconsistent watering (a defense move, not disease).',
          action: 'Keep watering consistent and add afternoon shade if temps run hot; new growth should look normal.' });
      }
      if (a.q2 === 'yes') {
        out.push({ title: 'Pest feeding damage', confidence: 'Likely', risk: 'soon',
          explain: 'Curling with visible insects usually means something is feeding underneath and distorting new growth as it expands.',
          action: 'Look closely for aphids, thrips, or mites on the undersides, and rinse them off with a strong water spray or insecticidal soap.' });
      }
      out.push({ title: 'Herbicide drift', confidence: 'Possible', risk: 'soon',
        explain: 'Sudden, severe curling across many leaves at once can point to nearby herbicide exposure, especially if it appeared quickly.',
        action: 'Check if any lawn or weed treatment happened nearby recently; new growth usually recovers even if affected leaves do not.' });
      return out;
    },
  },
  spots: {
    icon: '🔸',
    label: 'Spots or blotches',
    q1: { text: 'What color are the spots?', options: [
      { key: 'brown', label: 'Brown or black' },
      { key: 'yellowhalo', label: 'Small with yellow halo' },
      { key: 'white', label: 'White, powdery' },
    ]},
    q2: { text: 'Do the leaves feel wet / slimy or dry?', options: [
      { key: 'wet', label: 'Wet or slimy' },
      { key: 'dry', label: 'Dry, papery' },
    ]},
    resolve(a) {
      const out: TriageCause[] = [];
      if (a.q1 === 'brown' && a.q2 === 'wet') {
        out.push({ title: 'Fungal blight', confidence: 'Likely', risk: 'soon',
          explain: 'Dark, wet-looking spots that spread, often starting on lower leaves, are a classic sign of early blight or similar fungal disease.',
          action: 'Remove affected leaves, avoid overhead watering, and improve airflow around the plant.' });
      }
      if (a.q1 === 'yellowhalo') {
        out.push({ title: 'Bacterial leaf spot', confidence: 'Possible', risk: 'soon',
          explain: 'Small spots ringed with yellow are typical of bacterial infections, which spread fastest in wet, humid conditions.',
          action: 'Avoid working around wet plants, remove badly affected leaves, and water at the base rather than overhead.' });
      }
      if (a.q1 === 'white') {
        out.push({ title: 'Powdery mildew', confidence: 'Likely', risk: 'soon',
          explain: 'A white, powdery coating is a very recognizable fungal issue, especially common on cucumbers in humid or crowded conditions.',
          action: 'Improve airflow by thinning nearby foliage, and treat early spots with a diluted milk or baking soda spray.' });
      }
      out.push({ title: 'Sunscald or mechanical damage', confidence: 'Possible', risk: 'low',
        explain: 'Dry, papery spots that are not spreading can be sun damage or minor physical injury rather than disease.',
        action: 'Watch over the next few days. If it stays put and does not spread, it likely is not infectious.' });
      return out;
    },
  },
  pests: {
    icon: '🐛',
    label: 'Visible pests',
    q1: { text: 'Where are you seeing them?', options: [
      { key: 'underside', label: 'Underside of leaves' },
      { key: 'stems', label: 'On stems or fruit' },
      { key: 'soil', label: 'On the soil surface' },
    ]},
    q2: { text: 'What do they look like?', options: [
      { key: 'clusters', label: 'Tiny green/black clusters' },
      { key: 'cottony', label: 'White, cottony' },
      { key: 'flying', label: 'Small white, flying' },
    ]},
    resolve(a) {
      const out: TriageCause[] = [];
      if (a.q2 === 'clusters') {
        out.push({ title: 'Aphids', confidence: 'Likely', risk: 'soon',
          explain: 'Small clustered insects on new growth or leaf undersides are almost always aphids, which multiply fast but are easy to manage early.',
          action: 'Spray them off with water or use insecticidal soap, and check back in a few days since they rebound quickly.' });
      }
      if (a.q2 === 'cottony') {
        out.push({ title: 'Mealybugs', confidence: 'Possible', risk: 'soon',
          explain: 'A white, cottony residue in leaf joints or on stems is characteristic of mealybugs, which hide in tight spaces.',
          action: 'Dab visible clusters with rubbing alcohol on a cotton swab, and isolate the plant if others are nearby.' });
      }
      if (a.q2 === 'flying') {
        out.push({ title: 'Whiteflies', confidence: 'Possible', risk: 'soon',
          explain: 'Tiny white insects that flutter up when disturbed are usually whiteflies, which cluster on leaf undersides.',
          action: 'Yellow sticky traps help monitor numbers, and a strong water spray can knock down light infestations.' });
      }
      out.push({ title: 'General pest pressure', confidence: 'Possible', risk: 'low',
        explain: 'Without a clear match, it is worth watching how fast numbers grow over the next few days.',
        action: 'Check the same leaves daily so you catch a growing problem early rather than guessing now.' });
      return out;
    },
  },
  slow_growth: {
    icon: '🐢',
    label: 'Slow growth',
    q1: { text: 'Is the leaf color pale or normal green?', options: [
      { key: 'pale', label: 'Pale or washed out' },
      { key: 'normal', label: 'Normal green' },
    ]},
    q2: { text: 'Recently transplanted, or established a while?', options: [
      { key: 'recent', label: 'Recently transplanted' },
      { key: 'established', label: 'Established a while' },
    ]},
    resolve(a) {
      const out: TriageCause[] = [];
      if (a.q1 === 'pale' && a.q2 === 'recent') {
        out.push({ title: 'Transplant shock', confidence: 'Likely', risk: 'low',
          explain: 'A pale, slow-to-grow look right after transplanting is normal while roots reestablish in new soil.',
          action: 'Keep watering consistent and give it 1-2 weeks before changing anything else.' });
      }
      if (a.q1 === 'pale' && a.q2 === 'established') {
        out.push({ title: 'Nutrient deficiency', confidence: 'Likely', risk: 'soon',
          explain: 'Pale, slow growth in a plant that has been settled for a while usually points to the soil running low on available nutrients.',
          action: 'Side-dress with compost or a balanced organic fertilizer and watch for new growth to green up over 1-2 weeks.' });
      }
      if (a.q1 === 'normal' && a.q2 === 'recent') {
        out.push({ title: 'Just settling in', confidence: 'Likely', risk: 'low',
          explain: 'Normal green color with slow growth right after transplanting is often just the plant prioritizing roots over top growth.',
          action: 'No action needed yet. Growth usually picks up once roots are established.' });
      }
      out.push({ title: 'Root-bound or crowded roots', confidence: 'Possible', risk: 'low',
        explain: 'If growth has stalled for a while regardless of care, roots may be crowded or compacted in the bed.',
        action: 'Gently check root spread near the surface, and make sure plant spacing is not too tight.' });
      return out;
    },
  },
};
