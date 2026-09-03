// alertsEngine.ts
import { CropKey, WeatherSnapshot } from './scheduleEngine';
import { FrostEstimate } from '../types';
import { plantingGuidanceFor } from './plantingGuide';

export type PlantedBucket = 'w0' | 'w2' | 'w4' | 'w8'; // not planted yet / 1-4wk / 4-8wk / 8+wk since planting
export type Severity = 'soon' | 'fyi' | 'low';

export interface GardenAlert {
  crop: CropKey;
  headline: string;
  detail: string;
  severity: Severity;
}

interface StageEntry {
  headline: string;
  detail: string;
  severity: Severity;
}

// Every w0 entry below is unused dead data — getAlerts() intercepts bucket
// 'w0' before it ever reaches this table and builds the alert from
// plantingGuideFor() instead (real "when/how to plant" guidance keyed off
// the user's frost date, not generic post-planting care). Left in place
// only because trimming them would mean loosening this table's type from
// a full per-bucket Record to a Partial one, for no real benefit.
const STAGE_TABLE: Partial<Record<CropKey, Record<PlantedBucket, StageEntry>>> = {
  tomatoes: {
    w0: { headline: 'Establishing roots', detail: 'Keep soil evenly moist and hold off on heavy feeding until new growth kicks in.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Roots and foliage are filling in. Consistent watering now sets up healthier fruiting later.', severity: 'low' },
    w4: { headline: 'Water on a consistent schedule', detail: 'Uneven watering during fruit set is the top cause of blossom end rot. Keep sessions consistent rather than skipping and catching up.', severity: 'soon' },
    w8: { headline: 'Keep watering steady, not deep', detail: 'Big swings in soil moisture now can crack ripening fruit. Steady, even watering matters more than volume.', severity: 'soon' },
  },
  cucumbers: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Water consistently through flowering', detail: 'Inconsistent watering around flowering is a common cause of bitter-tasting fruit later.', severity: 'soon' },
    w4: { headline: 'Check the vines daily for ripe cucumbers', detail: 'Once fruit sizes up, check daily. Cucumbers hide under leaves and go from ready to overripe fast.', severity: 'soon' },
    w8: { headline: 'Peak production', detail: 'Harvest every 1-2 days at this stage to keep the vine productive.', severity: 'fyi' },
  },
  lettuce: {
    w0: { headline: 'Seedling stage', detail: 'Keep consistently moist and thin crowded seedlings for airflow.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Growth should be picking up. Keep an eye on moisture since shallow roots dry out fast.', severity: 'low' },
    w4: { headline: 'Near harvest size', detail: 'Start checking daily, especially once warmer weather arrives.', severity: 'fyi' },
    w8: { headline: 'Harvest the lettuce soon', detail: 'Older lettuce bolts (turns bitter, goes to seed) fast once heat arrives, worth harvesting sooner rather than later.', severity: 'soon' },
  },
  carrots: {
    w0: { headline: 'Germinating', detail: 'Carrot seeds are slow and finicky. Keep the soil surface consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Root development starting', detail: 'Consistent watering now helps avoid forked or split roots later.', severity: 'low' },
    w4: { headline: 'Root development', detail: 'Keep watering even. This is when root shape is being set.', severity: 'fyi' },
    w8: { headline: 'Nearing maturity', detail: 'Watch for shoulders showing at the soil surface as a sign they are close to ready.', severity: 'fyi' },
  },
  peppers: {
    w0: { headline: 'Establishing', detail: 'Keep soil evenly moist. Avoid overwatering young seedlings.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Steady watering supports the first flowers about to appear.', severity: 'low' },
    w4: { headline: 'Water on a consistent schedule', detail: 'Uneven moisture during fruit set is a common cause of blossom drop. Keep watering consistent.', severity: 'soon' },
    w8: { headline: 'Fruiting, coloring up', detail: 'Leave peppers on the plant to color up fully for the sweetest flavor.', severity: 'fyi' },
  },
  basil: {
    w0: { headline: 'Germinating', detail: 'Keep soil warm and consistently moist while it germinates.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Pinch the growing tips to encourage bushier growth.', severity: 'low' },
    w4: { headline: 'Ready to harvest', detail: 'Snip from the top regularly. That keeps it productive and delays flowering.', severity: 'fyi' },
    w8: { headline: 'Pinch off any flower spikes', detail: 'Pinch off flower spikes right away or the leaves turn bitter.', severity: 'soon' },
  },
  potatoes: {
    w0: { headline: 'Sprouting', detail: 'Keep soil moist and hill soil around stems as they emerge.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Keep hilling as plants grow to protect developing tubers from light.', severity: 'low' },
    w4: { headline: 'Water consistently while tubers bulk up', detail: 'Keep watering consistent. Tubers are bulking up now, and this stage sets your yield.', severity: 'soon' },
    w8: { headline: 'Bulking, nearing maturity', detail: 'Ease off watering as foliage yellows. That is the harvest signal.', severity: 'fyi' },
  },
  garlic: {
    w0: { headline: 'Establishing', detail: 'Keep soil moist while roots establish.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Steady moisture now supports bulb development later.', severity: 'low' },
    w4: { headline: 'Bulbing', detail: 'Water needs increase as bulbs start to size up.', severity: 'fyi' },
    w8: { headline: 'Curing soon', detail: 'Reduce watering as leaves yellow. Harvest once 5–6 leaves have browned.', severity: 'fyi' },
  },
  strawberries: {
    w0: { headline: 'Establishing', detail: 'Keep crowns moist but not waterlogged.', severity: 'low' },
    w2: { headline: 'Runners & leaves', detail: 'Remove early runners so the plant focuses energy on itself.', severity: 'low' },
    w4: { headline: 'Water consistently through flowering', detail: 'Keep watering consistent. This sets fruit size.', severity: 'soon' },
    w8: { headline: 'Check for ripe berries to pick', detail: 'Pick every couple of days once berries redden. Shallow roots dry out fast.', severity: 'soon' },
  },
  squash: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Water consistently and watch for pollinators', detail: 'Plants sprawl quickly now. Keep watering consistent to support rapid growth, and watch for pollinators once flowers open.', severity: 'soon' },
    w4: { headline: 'Check flowers for pollinator activity', detail: 'Watch for both male and female flowers. Bees need to be around for fruit to set.', severity: 'soon' },
    w8: { headline: 'Fruiting', detail: 'Harvest summer squash small and often to keep the plant producing.', severity: 'fyi' },
  },
  corn: {
    w0: { headline: 'Germinating', detail: 'Keep soil moist until seedlings are up.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Steady watering builds a strong stalk.', severity: 'low' },
    w4: { headline: 'Do not let the corn dry out', detail: 'Do not let it dry out now. This is the most water-critical stage for how well ears fill.', severity: 'soon' },
    w8: { headline: 'Filling ears', detail: 'Check for milky kernels and brown, dry silks as the harvest signal.', severity: 'fyi' },
  },
  onions: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist near the surface. Shallow roots dry out fast.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Steady watering builds the leaf growth that determines bulb size.', severity: 'low' },
    w4: { headline: 'Bulbing', detail: 'Keep water needs high. Bulbs are swelling now.', severity: 'fyi' },
    w8: { headline: 'Curing soon', detail: 'Stop watering once tops yellow and fall over. That is the cue bulbs are ready.', severity: 'fyi' },
  },
  broccoli: {
    w0: { headline: 'Establishing', detail: 'Keep soil evenly moist while roots establish.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Consistent watering now builds the leaf growth the head will draw on.', severity: 'low' },
    w4: { headline: 'Keep the soil consistently moist', detail: 'Do not let it dry out. Water stress now causes small or loose heads.', severity: 'soon' },
    w8: { headline: 'Harvest before the head starts to yellow', detail: 'Harvest the center head while buds are still tight, before any yellow shows.', severity: 'soon' },
  },
  cauliflower: {
    w0: { headline: 'Establishing', detail: 'Keep soil evenly moist while roots establish.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Consistent watering supports steady, unchecked growth.', severity: 'low' },
    w4: { headline: 'Keep watering even', detail: 'Keep watering even. Any check in growth causes small or bitter heads.', severity: 'soon' },
    w8: { headline: 'Tie outer leaves over the head', detail: 'Once the head is visible, tie outer leaves over it to keep it white.', severity: 'soon' },
  },
  cabbage: {
    w0: { headline: 'Establishing', detail: 'Keep soil evenly moist while roots establish.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Consistent watering now builds the leaf growth the head will draw on.', severity: 'low' },
    w4: { headline: 'Keep watering steady, no dry spells', detail: 'Keep watering steady. Splits happen when dry spells are followed by heavy watering.', severity: 'soon' },
    w8: { headline: 'Check heads for firmness', detail: 'Heads are ready once firm to a gentle squeeze.', severity: 'soon' },
  },
  kale: {
    w0: { headline: 'Seedling stage', detail: 'Keep soil consistently moist while seedlings establish.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings so remaining plants have room to fill out.', severity: 'low' },
    w4: { headline: 'Established, harvestable', detail: 'Harvest outer leaves as needed. New growth keeps coming from the center.', severity: 'fyi' },
    w8: { headline: 'Full production', detail: 'Keep picking outer leaves regularly. Flavor sweetens after a light frost.', severity: 'fyi' },
  },
  spinach: {
    w0: { headline: 'Seedling stage', detail: 'Keep soil consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings for airflow and room to size up.', severity: 'low' },
    w4: { headline: 'Near harvest size', detail: 'Start checking daily once warmer weather arrives; it bolts fast.', severity: 'fyi' },
    w8: { headline: 'Harvest the spinach soon', detail: 'Harvest soon. Older spinach turns bitter and bolts once heat sets in.', severity: 'soon' },
  },
  chard: {
    w0: { headline: 'Seedling stage', detail: 'Keep soil consistently moist while seedlings establish.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings so remaining plants have room to fill out.', severity: 'low' },
    w4: { headline: 'Established, harvestable', detail: 'Harvest outer leaves as needed. New growth keeps coming from the center.', severity: 'fyi' },
    w8: { headline: 'Full production', detail: 'Keep picking outer leaves regularly. It keeps producing all season.', severity: 'fyi' },
  },
  beets: {
    w0: { headline: 'Germinating', detail: 'Keep the soil surface consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Root development starting', detail: 'Thin seedlings to a few inches apart so roots have room to size up.', severity: 'low' },
    w4: { headline: 'Root development', detail: 'Keep watering even. This is when root shape is being set.', severity: 'fyi' },
    w8: { headline: 'Nearing maturity', detail: 'Roots are usually ready once shoulders show at the soil surface.', severity: 'fyi' },
  },
  radishes: {
    w0: { headline: 'Germinating', detail: 'Keep the soil surface consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Root development starting', detail: 'Thin seedlings so roots have room; crowding causes small, misshapen radishes.', severity: 'low' },
    w4: { headline: 'Root development', detail: 'Keep watering even. Irregular watering causes cracked or woody roots.', severity: 'fyi' },
    w8: { headline: 'Pull radishes once they are sized up', detail: 'Pull them promptly once sized up. They turn hot and pithy if left too long.', severity: 'soon' },
  },
  turnips: {
    w0: { headline: 'Germinating', detail: 'Keep the soil surface consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Root development starting', detail: 'Thin seedlings so roots have room to size up.', severity: 'low' },
    w4: { headline: 'Root development', detail: 'Keep watering even. This is when root shape is being set.', severity: 'fyi' },
    w8: { headline: 'Nearing maturity', detail: 'Pull once golf-ball to tennis-ball sized; larger roots turn woody.', severity: 'fyi' },
  },
  peas: {
    w0: { headline: 'Germinating', detail: 'Keep the soil surface consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Vining', detail: 'Give vines something to climb. Consistent watering supports steady growth.', severity: 'low' },
    w4: { headline: 'Keep watering even through flowering', detail: 'Keep watering even as flowers appear; dry spells now reduce pod set.', severity: 'soon' },
    w8: { headline: 'Pick pods that have filled out', detail: 'Pick every day or two once pods fill out. Regular picking keeps more coming.', severity: 'soon' },
  },
  beans: {
    w0: { headline: 'Establishing', detail: 'Keep soil evenly moist. Seeds can rot in waterlogged soil.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Consistent watering now supports strong growth before flowering.', severity: 'low' },
    w4: { headline: 'Keep watering steady through flowering', detail: 'Keep watering steady as flowers appear; dry spells now reduce pod set.', severity: 'soon' },
    w8: { headline: 'Pick pods before they toughen', detail: 'Pick regularly once pods fill out. Beans left too long turn tough and stringy.', severity: 'soon' },
  },
  zucchini: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Water consistently and watch for pollinators', detail: 'Plants sprawl quickly now. Keep watering consistent, and watch for pollinators once flowers open.', severity: 'soon' },
    w4: { headline: 'Check flowers for pollinator activity', detail: 'Watch for both male and female flowers. Bees need to be around for fruit to set.', severity: 'soon' },
    w8: { headline: 'Check daily for zucchini ready to pick', detail: 'Check daily once it starts. Size doubles fast and oversized ones turn tough.', severity: 'soon' },
  },
  pumpkin: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Give the vines room to sprawl', detail: 'Plants sprawl quickly now. Give vines plenty of room.', severity: 'soon' },
    w4: { headline: 'Check flowers for pollinator activity', detail: 'Watch for both male and female flowers. Bees need to be around for fruit to set.', severity: 'soon' },
    w8: { headline: 'Fruiting, sizing up', detail: 'Let fruit fully color and the vine start to die back before harvesting.', severity: 'fyi' },
  },
  eggplant: {
    w0: { headline: 'Establishing', detail: 'Keep soil evenly moist. Avoid overwatering young seedlings.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Steady watering supports the first flowers about to appear.', severity: 'low' },
    w4: { headline: 'Water on a consistent schedule', detail: 'Uneven moisture during fruit set causes fruit drop. Keep watering consistent.', severity: 'soon' },
    w8: { headline: 'Fruiting', detail: 'Harvest while skin is still glossy; dull skin means it is overripe.', severity: 'fyi' },
  },
  celery: {
    w0: { headline: 'Establishing', detail: 'Keep soil evenly moist while roots establish; celery does not tolerate drying out.', severity: 'low' },
    w2: { headline: 'Water frequently, celery stays thirsty', detail: 'Water frequently. Celery is thirsty throughout its whole season.', severity: 'soon' },
    w4: { headline: 'Do not let it dry out, even briefly', detail: 'Do not let it dry out even briefly. Stress now causes stringy, bitter stalks.', severity: 'soon' },
    w8: { headline: 'Nearing maturity', detail: 'Harvest outer stalks as needed, or cut the whole head at the base.', severity: 'fyi' },
  },
  asparagus: {
    w0: { headline: 'Establishing', detail: 'Keep crowns moist while roots establish. Do not harvest this first year.', severity: 'low' },
    w2: { headline: 'Fern growth', detail: 'Let the ferny top growth run. It is building the root system for future years.', severity: 'low' },
    w4: { headline: 'Building root reserves', detail: 'Keep watering steady. Strong fern growth now means a better harvest in year three.', severity: 'low' },
    w8: { headline: 'End of establishment year', detail: 'Leave the ferns standing through fall; they feed the roots for next spring.', severity: 'fyi' },
  },
  brusselssprouts: {
    w0: { headline: 'Establishing', detail: 'Keep soil evenly moist while roots establish.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Consistent watering now builds the leaf growth sprouts will draw on.', severity: 'low' },
    w4: { headline: 'Sprouts forming', detail: 'Keep watering steady as sprouts begin forming along the stalk.', severity: 'fyi' },
    w8: { headline: 'Filling out', detail: 'Harvest from the bottom up as sprouts firm up; flavor improves after a light frost.', severity: 'fyi' },
  },
  leeks: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots establish.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Steady watering supports the leaf growth that feeds the shaft.', severity: 'low' },
    w4: { headline: 'Shaft thickening', detail: 'Hill soil up around the stem as it grows to blanch it white.', severity: 'fyi' },
    w8: { headline: 'Nearing harvest', detail: 'Harvest once the shaft is an inch or more thick, any time you need them.', severity: 'fyi' },
  },
  okra: {
    w0: { headline: 'Establishing', detail: 'Keep soil moist until seedlings are up; okra likes it warm.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Consistent watering now supports strong growth before flowering.', severity: 'low' },
    w4: { headline: 'Keep watering steady through flowering', detail: 'Keep watering steady as flowers appear.', severity: 'soon' },
    w8: { headline: 'Pick pods while young and tender', detail: 'Pick pods every day or two while young and tender; overgrown pods turn woody.', severity: 'soon' },
  },
  sweetpotatoes: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while slips establish.', severity: 'low' },
    w2: { headline: 'Vining', detail: 'Vines will start to sprawl. Consistent watering supports root development below.', severity: 'low' },
    w4: { headline: 'Water steadily while roots bulk up', detail: 'Keep watering steady. This is when the roots are bulking up.', severity: 'soon' },
    w8: { headline: 'Bulking, nearing maturity', detail: 'Ease off watering as the season winds down; that helps roots cure for storage.', severity: 'fyi' },
  },
  rutabaga: {
    w0: { headline: 'Germinating', detail: 'Keep the soil surface consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Root development starting', detail: 'Thin seedlings so roots have room to size up.', severity: 'low' },
    w4: { headline: 'Root development', detail: 'Keep watering even. This is when root shape is being set.', severity: 'fyi' },
    w8: { headline: 'Nearing maturity', detail: 'Roots hold well in the ground; harvest once they reach a good size.', severity: 'fyi' },
  },
  kohlrabi: {
    w0: { headline: 'Germinating', detail: 'Keep soil consistently moist while seedlings establish.', severity: 'low' },
    w2: { headline: 'Bulb forming', detail: 'Consistent watering now supports the bulb starting to swell above the soil.', severity: 'low' },
    w4: { headline: 'Bulb sizing up', detail: 'Keep watering even as the bulb sizes up.', severity: 'fyi' },
    w8: { headline: 'Harvest while the bulb is still small', detail: 'Harvest while the bulb is still small and tender; oversized ones turn woody.', severity: 'soon' },
  },
  arugula: {
    w0: { headline: 'Seedling stage', detail: 'Keep soil consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings for airflow and room to fill out.', severity: 'low' },
    w4: { headline: 'Near harvest size', detail: 'Start checking daily once warmer weather arrives; it bolts fast.', severity: 'fyi' },
    w8: { headline: 'Harvest the arugula soon', detail: 'Harvest soon. It turns sharp and peppery once it starts to bolt.', severity: 'soon' },
  },
  collards: {
    w0: { headline: 'Seedling stage', detail: 'Keep soil consistently moist while seedlings establish.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings so remaining plants have room to fill out.', severity: 'low' },
    w4: { headline: 'Established, harvestable', detail: 'Harvest outer leaves as needed. New growth keeps coming from the center.', severity: 'fyi' },
    w8: { headline: 'Full production', detail: 'Keep picking outer leaves regularly. Flavor sweetens after a light frost.', severity: 'fyi' },
  },
  bokchoy: {
    w0: { headline: 'Seedling stage', detail: 'Keep soil consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings for airflow and room to fill out.', severity: 'low' },
    w4: { headline: 'Near harvest size', detail: 'Start checking daily once warmer weather arrives; it bolts fast.', severity: 'fyi' },
    w8: { headline: 'Harvest the bok choy soon', detail: 'Harvest soon. It turns bitter fast once it starts to bolt.', severity: 'soon' },
  },
  cilantro: {
    w0: { headline: 'Germinating', detail: 'Keep soil consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings for airflow.', severity: 'low' },
    w4: { headline: 'Near harvest size', detail: 'Start checking daily once warmer weather arrives; it bolts fast in heat.', severity: 'fyi' },
    w8: { headline: 'Harvest the cilantro soon', detail: 'Harvest soon. Once it bolts, leaves turn bitter, save the flowers for coriander seed.', severity: 'soon' },
  },
  parsley: {
    w0: { headline: 'Germinating', detail: 'Keep soil consistently moist; parsley is slow and can take weeks to sprout.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings for airflow.', severity: 'low' },
    w4: { headline: 'Established, harvestable', detail: 'Snip outer stems as needed. New growth keeps coming from the center.', severity: 'fyi' },
    w8: { headline: 'Full production', detail: 'Keep harvesting outer stems regularly to encourage fresh growth.', severity: 'fyi' },
  },
  mint: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while it establishes.', severity: 'low' },
    w2: { headline: 'Spreading', detail: 'It spreads fast. Keep it contained if you do not want it taking over the bed.', severity: 'fyi' },
    w4: { headline: 'Established, harvestable', detail: 'Snip from the top regularly. That keeps it bushy and productive.', severity: 'fyi' },
    w8: { headline: 'Full production', detail: 'Keep harvesting regularly. Frequent picking is what keeps it productive.', severity: 'fyi' },
  },
  rosemary: {
    w0: { headline: 'Establishing', detail: 'Keep soil lightly moist while roots establish, then ease off.', severity: 'low' },
    w2: { headline: 'Rooting in', detail: 'Let the soil surface dry between waterings. It dislikes wet roots.', severity: 'low' },
    w4: { headline: 'Established, light harvest', detail: 'Water sparingly. Rosemary is drought-tolerant once established.', severity: 'low' },
    w8: { headline: 'Full flavor', detail: 'Snip sprigs as needed; regular light harvesting encourages bushier growth.', severity: 'fyi' },
  },
  thyme: {
    w0: { headline: 'Establishing', detail: 'Keep soil lightly moist while roots establish, then ease off.', severity: 'low' },
    w2: { headline: 'Rooting in', detail: 'Let the soil surface dry between waterings. It dislikes wet roots.', severity: 'low' },
    w4: { headline: 'Established, light harvest', detail: 'Water sparingly. Thyme is drought-tolerant once established.', severity: 'low' },
    w8: { headline: 'Full flavor', detail: 'Snip sprigs as needed; regular light harvesting encourages bushier growth.', severity: 'fyi' },
  },
  oregano: {
    w0: { headline: 'Establishing', detail: 'Keep soil lightly moist while roots establish, then ease off.', severity: 'low' },
    w2: { headline: 'Rooting in', detail: 'Let the soil surface dry between waterings. It dislikes wet roots.', severity: 'low' },
    w4: { headline: 'Established, light harvest', detail: 'Water sparingly; it is more flavorful when grown a little lean.', severity: 'low' },
    w8: { headline: 'Full flavor', detail: 'Snip sprigs as needed; regular light harvesting encourages bushier growth.', severity: 'fyi' },
  },
  dill: {
    w0: { headline: 'Germinating', detail: 'Keep soil consistently moist until you see sprouts.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings for airflow.', severity: 'low' },
    w4: { headline: 'Near harvest size', detail: 'Start checking daily once warmer weather arrives; it bolts fast in heat.', severity: 'fyi' },
    w8: { headline: 'Harvest the dill soon', detail: 'Harvest soon. Once it flowers, leaves turn sparse, save the heads for seed.', severity: 'soon' },
  },
  chives: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while seedlings establish.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Thin crowded seedlings for airflow.', severity: 'low' },
    w4: { headline: 'Established, harvestable', detail: 'Snip from the outside as needed. New growth keeps coming from the center.', severity: 'fyi' },
    w8: { headline: 'Full production', detail: 'Keep harvesting regularly; frequent picking encourages fresh, tender growth.', severity: 'fyi' },
  },
  sage: {
    w0: { headline: 'Establishing', detail: 'Keep soil lightly moist while roots establish, then ease off.', severity: 'low' },
    w2: { headline: 'Rooting in', detail: 'Let the soil surface dry between waterings. It dislikes wet roots.', severity: 'low' },
    w4: { headline: 'Established, light harvest', detail: 'Water sparingly. Sage is drought-tolerant once established.', severity: 'low' },
    w8: { headline: 'Full flavor', detail: 'Snip leaves as needed; avoid heavy harvesting until the plant is well established.', severity: 'fyi' },
  },
  watermelon: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Give the vines room to sprawl', detail: 'Plants sprawl quickly now. Give vines plenty of room.', severity: 'soon' },
    w4: { headline: 'Watch for flowers and pollinator activity', detail: 'Watch for flowers. Bees need to be around for fruit to set.', severity: 'soon' },
    w8: { headline: 'Fruiting, sizing up', detail: 'Check the tendril nearest the fruit; it browning and drying is a ripeness cue.', severity: 'fyi' },
  },
  cantaloupe: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Give the vines room to sprawl', detail: 'Plants sprawl quickly now. Give vines plenty of room.', severity: 'soon' },
    w4: { headline: 'Watch for flowers and pollinator activity', detail: 'Watch for flowers. Bees need to be around for fruit to set.', severity: 'soon' },
    w8: { headline: 'Fruiting, ripening', detail: 'A ripe melon slips easily from the vine with gentle pressure.', severity: 'fyi' },
  },
  blueberries: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist; blueberries have shallow roots and need acidic soil.', severity: 'low' },
    w2: { headline: 'Rooting in', detail: 'Water regularly while it roots in. Mulch helps hold moisture.', severity: 'low' },
    w4: { headline: 'Leafing out', detail: 'Keep watering steady. This first year is about building a strong root system.', severity: 'low' },
    w8: { headline: 'End of establishment year', detail: 'Expect only a light harvest, if any, this first year. Fuller crops come in future years.', severity: 'fyi' },
  },
  raspberries: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while canes root in.', severity: 'low' },
    w2: { headline: 'Cane growth', detail: 'New cane growth is establishing. Keep watering steady.', severity: 'low' },
    w4: { headline: 'Cane growth continuing', detail: 'Keep watering consistent as canes continue to develop.', severity: 'low' },
    w8: { headline: 'End of establishment year', detail: 'This first season is mostly about establishing; fuller harvests come next year.', severity: 'fyi' },
  },
  blackberries: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while canes root in.', severity: 'low' },
    w2: { headline: 'Cane growth', detail: 'New cane growth is establishing. Keep watering steady.', severity: 'low' },
    w4: { headline: 'Cane growth continuing', detail: 'Keep watering consistent as canes continue to develop.', severity: 'low' },
    w8: { headline: 'End of establishment year', detail: 'This first season is mostly about establishing; fuller harvests come next year.', severity: 'fyi' },
  },
  grapes: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots establish.', severity: 'low' },
    w2: { headline: 'Vine growth', detail: 'Train the young vine onto its trellis or support as it grows.', severity: 'low' },
    w4: { headline: 'Establishing root system', detail: 'This first year is about building roots and a strong trunk, not fruit.', severity: 'low' },
    w8: { headline: 'End of establishment year', detail: 'Expect little to no fruit this first year; full production typically starts around year three.', severity: 'fyi' },
  },
  rhubarb: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots establish. Do not harvest this first year.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Let the plant grow undisturbed. It is building the root system for future years.', severity: 'low' },
    w4: { headline: 'Building root reserves', detail: 'Keep watering steady. A strong first year means a better harvest starting next year.', severity: 'low' },
    w8: { headline: 'End of establishment year', detail: 'Leave the plant alone through fall; it is storing energy in the roots for next spring.', severity: 'fyi' },
  },
  figs: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots establish.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Let the tree focus on establishing this first year rather than fruiting heavily.', severity: 'low' },
    w4: { headline: 'Building root reserves', detail: 'Keep watering steady while the root system develops.', severity: 'low' },
    w8: { headline: 'End of establishment year', detail: 'Expect only a light crop, if any, this first year. Fuller harvests come in future years.', severity: 'fyi' },
  },
  marigold: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Pinch growing tips once seedlings have a few sets of leaves to encourage bushier, fuller plants.', severity: 'low' },
    w4: { headline: 'Budding up', detail: 'First flower buds should be forming. Deadhead spent blooms regularly to keep new ones coming.', severity: 'fyi' },
    w8: { headline: 'Full bloom', detail: 'Keep deadheading spent flowers. Regular deadheading is what keeps marigolds blooming until frost.', severity: 'fyi' },
  },
  zinnia: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Pinch the center stem once it has a few sets of leaves to encourage branching and more blooms.', severity: 'low' },
    w4: { headline: 'Budding up', detail: 'Buds are forming now. Keep watering consistent through this stage.', severity: 'fyi' },
    w8: { headline: 'Full bloom', detail: 'Cut flowers regularly for bouquets; frequent cutting is what keeps zinnias blooming.', severity: 'fyi' },
  },
  sunflower: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Grows fast once established. Stake tall varieties in windy spots.', severity: 'low' },
    w4: { headline: 'Budding up', detail: 'The bud will start tracking the sun as it forms.', severity: 'fyi' },
    w8: { headline: 'Full bloom', detail: "Leave the head on the stalk if you want to save seeds for birds or next year's planting.", severity: 'fyi' },
  },
  cosmos: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Vegetative growth', detail: 'Pinch young plants to encourage bushier growth and more flowering stems.', severity: 'low' },
    w4: { headline: 'Budding up', detail: 'Feathery foliage fills in fast. Buds should start appearing soon.', severity: 'fyi' },
    w8: { headline: 'Full bloom', detail: 'Deadhead regularly; cosmos blooms nonstop through frost if spent flowers are kept cut back.', severity: 'fyi' },
  },
  nasturtium: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while roots take hold.', severity: 'low' },
    w2: { headline: 'Vining growth', detail: 'Sprawls or vines quickly. Give it room, or a trellis for climbing types.', severity: 'low' },
    w4: { headline: 'Budding up', detail: 'Poor soil actually produces more flowers; hold off on feeding.', severity: 'fyi' },
    w8: { headline: 'Full bloom', detail: 'Pick flowers and young leaves regularly for salads; that also keeps more blooms coming.', severity: 'fyi' },
  },
  pansy: {
    w0: { headline: 'Establishing', detail: 'Keep soil consistently moist while it establishes.', severity: 'low' },
    w2: { headline: 'Leafing out', detail: 'Keep soil consistently moist while it establishes.', severity: 'low' },
    w4: { headline: 'Budding up', detail: 'Cool weather brings on the first flowers.', severity: 'fyi' },
    w8: { headline: 'Full bloom', detail: 'Deadhead spent blooms regularly to keep new flowers coming.', severity: 'fyi' },
  },
};

const SEVERITY_ORDER: Record<Severity, number> = { soon: 0, fyi: 1, low: 2 };

/**
 * Builds a ranked list of forward-looking alerts from crop mix, time-since-planting,
 * live weather data, and (for anything not planted yet) the user's frost-date
 * estimate. Caps to 4 so the home screen doesn't get noisy.
 */
export function getAlerts(
  crops: CropKey[],
  plantedWeeks: Partial<Record<CropKey, PlantedBucket>>,
  weather: WeatherSnapshot | null | undefined,
  frostDates?: FrostEstimate | null
): GardenAlert[] {
  const list: GardenAlert[] = [];

  for (const crop of crops) {
    if (crop === 'other') continue;
    const bucket = plantedWeeks[crop] ?? 'w2';
    if (bucket === 'w0') {
      const guidance = plantingGuidanceFor(crop, frostDates);
      list.push({
        crop,
        headline: guidance.headline,
        detail: guidance.detail,
        severity: guidance.isPastDue ? 'soon' : 'low',
      });
    } else {
      const table = STAGE_TABLE[crop];
      const base = table?.[bucket];
      if (base) {
        list.push({ crop, headline: base.headline, detail: base.detail, severity: base.severity });
      }
    }

    if (crop === 'lettuce' && weather?.forecastMaxTempF && weather.forecastMaxTempF >= 80) {
      list.push({
        crop,
        headline: 'Harvest soon or add shade',
        detail: `Forecast highs near ${weather.forecastMaxTempF}°F could push lettuce to bolt within about a week. Consider harvesting soon or adding shade.`,
        severity: 'soon',
      });
    }

    if (
      crop === 'tomatoes' &&
      (bucket === 'w4' || bucket === 'w8') &&
      weather &&
      weather.upcomingRainIn > 0.1 &&
      (weather.recentRainIn ?? 0) < 0.05
    ) {
      list.push({
        crop,
        headline: 'Water lightly before the rain hits',
        detail: "A sudden drench after dry soil is a common trigger for blossom end rot and cracking. Water lightly now so the bed isn't bone-dry when rain arrives.",
        severity: 'soon',
      });
    }
  }

  list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return list.slice(0, 4);
}
