import { getTasksForDate, getTodayTasks } from '../taskEngine';
import { GardenProfile } from '../../types';
import { WeatherSnapshot } from '../scheduleEngine';

// Jan 23 2027 is a Saturday; Jan 20 a Wednesday.
const SAT = new Date(2027, 0, 23, 9);
const WED = new Date(2027, 0, 20, 9);
const NOV_1 = new Date(2026, 10, 1).toISOString();

function weather(tonightLowF: number): WeatherSnapshot {
  return {
    recentRainIn: 0,
    upcomingRainIn: 0,
    tempF: 40,
    forecastMaxTempF: 50,
    todayHighF: 50,
    todayLowF: 35,
    weatherCode: 0,
    tonightLowF,
  };
}

function makeProfile(overrides: Partial<GardenProfile> = {}): GardenProfile {
  return {
    schemaVersion: 1,
    crops: ['collards', 'chard', 'peppers'],
    plantedWeeks: { collards: 'w8', chard: 'w8', peppers: 'w0' },
    plantedDates: { collards: NOV_1, chard: NOV_1 },
    sun: 'full',
    bedWidthFt: 4,
    bedLengthFt: 4,
    method: 'drip',
    location: null,
    weather: weather(40),
    weatherFetchedAt: null,
    scheduledReminders: [],
    notificationsEnabled: true,
    savedAt: NOV_1,
    isPro: true,
    ...overrides,
  };
}

const find = (tasks: { id: string }[], prefix: string) => tasks.filter((t) => t.id.startsWith(prefix));

describe('frost protection', () => {
  it('names only the planted crops tonight’s low will hurt', () => {
    const [task] = find(getTodayTasks(makeProfile({ weather: weather(26) }), WED), 'frost-') as any[];
    expect(task.detail).toContain("Tonight's low is 26°F");
    expect(task.detail).toContain('Cover Swiss chard with');
    expect(task.detail).not.toContain('Collard'); // hardy to 20°F
    expect(task.detail).not.toContain('Peppers'); // not planted yet
  });

  it('covers the hardy greens too in a hard freeze', () => {
    const [task] = find(getTodayTasks(makeProfile({ weather: weather(18) }), WED), 'frost-') as any[];
    expect(task.detail).toContain('Cover Collard greens and Swiss chard');
  });

  it('says nothing on a mild night, or for free users', () => {
    expect(find(getTodayTasks(makeProfile(), WED), 'frost-')).toHaveLength(0);
    expect(find(getTodayTasks(makeProfile({ weather: weather(18), isPro: false }), WED), 'frost-')).toHaveLength(0);
  });

  it("matches on today's calendar cell", () => {
    expect(find(getTasksForDate(makeProfile({ weather: weather(26) }), WED, WED), 'frost-')).toHaveLength(1);
  });
});

describe('weekly greens picking', () => {
  it('shows one combined task on Saturdays', () => {
    const tasks = find(getTodayTasks(makeProfile(), SAT), 'pickgreens-') as any[];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Pick your Swiss chard and Collard greens');
  });

  it('is only on Saturdays, and shows ahead on the calendar', () => {
    expect(find(getTodayTasks(makeProfile(), WED), 'pickgreens-')).toHaveLength(0);
    expect(find(getTasksForDate(makeProfile(), SAT, WED), 'pickgreens-')).toHaveLength(1);
  });

  it('waits until the greens are big enough to pick', () => {
    const justPlanted = makeProfile({ plantedDates: { collards: new Date(2027, 0, 10).toISOString(), chard: new Date(2027, 0, 10).toISOString() } });
    expect(find(getTodayTasks(justPlanted, SAT), 'pickgreens-')).toHaveLength(0);
  });
});
