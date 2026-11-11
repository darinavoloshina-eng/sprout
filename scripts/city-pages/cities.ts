// The cities that get a planting-calendar page on gardenwise.io: every
// state's main gardening cities plus the largest metros. [name, state].
export const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

export const CITIES: [string, string][] = [
  ['Birmingham', 'AL'], ['Huntsville', 'AL'], ['Montgomery', 'AL'], ['Anchorage', 'AK'],
  ['Phoenix', 'AZ'], ['Tucson', 'AZ'], ['Mesa', 'AZ'], ['Flagstaff', 'AZ'], ['Little Rock', 'AR'], ['Fayetteville', 'AR'],
  ['Sacramento', 'CA'], ['Fresno', 'CA'], ['San Jose', 'CA'], ['Oakland', 'CA'], ['Los Angeles', 'CA'], ['San Diego', 'CA'],
  ['Bakersfield', 'CA'], ['Riverside', 'CA'], ['Santa Rosa', 'CA'], ['Redding', 'CA'],
  ['Denver', 'CO'], ['Colorado Springs', 'CO'], ['Fort Collins', 'CO'], ['Boulder', 'CO'],
  ['Hartford', 'CT'], ['New Haven', 'CT'], ['Wilmington', 'DE'], ['Washington', 'DC'],
  ['Jacksonville', 'FL'], ['Tallahassee', 'FL'], ['Orlando', 'FL'], ['Tampa', 'FL'], ['Gainesville', 'FL'],
  ['Atlanta', 'GA'], ['Savannah', 'GA'], ['Athens', 'GA'], ['Augusta', 'GA'], ['Boise', 'ID'], ['Idaho Falls', 'ID'],
  ['Chicago', 'IL'], ['Springfield', 'IL'], ['Peoria', 'IL'], ['Indianapolis', 'IN'], ['Fort Wayne', 'IN'],
  ['Des Moines', 'IA'], ['Cedar Rapids', 'IA'], ['Wichita', 'KS'], ['Topeka', 'KS'], ['Louisville', 'KY'], ['Lexington', 'KY'],
  ['New Orleans', 'LA'], ['Baton Rouge', 'LA'], ['Shreveport', 'LA'], ['Portland', 'ME'], ['Bangor', 'ME'],
  ['Baltimore', 'MD'], ['Frederick', 'MD'], ['Boston', 'MA'], ['Worcester', 'MA'], ['Springfield', 'MA'],
  ['Detroit', 'MI'], ['Grand Rapids', 'MI'], ['Ann Arbor', 'MI'], ['Lansing', 'MI'],
  ['Minneapolis', 'MN'], ['Saint Paul', 'MN'], ['Duluth', 'MN'], ['Rochester', 'MN'], ['Jackson', 'MS'],
  ['Kansas City', 'MO'], ['Saint Louis', 'MO'], ['Springfield', 'MO'], ['Billings', 'MT'], ['Missoula', 'MT'], ['Bozeman', 'MT'],
  ['Omaha', 'NE'], ['Lincoln', 'NE'], ['Las Vegas', 'NV'], ['Reno', 'NV'], ['Manchester', 'NH'], ['Concord', 'NH'],
  ['Newark', 'NJ'], ['Trenton', 'NJ'], ['Albuquerque', 'NM'], ['Santa Fe', 'NM'], ['Las Cruces', 'NM'],
  ['New York', 'NY'], ['Buffalo', 'NY'], ['Rochester', 'NY'], ['Syracuse', 'NY'], ['Albany', 'NY'],
  ['Charlotte', 'NC'], ['Raleigh', 'NC'], ['Durham', 'NC'], ['Greensboro', 'NC'], ['Asheville', 'NC'], ['Wilmington', 'NC'],
  ['Fargo', 'ND'], ['Bismarck', 'ND'], ['Columbus', 'OH'], ['Cleveland', 'OH'], ['Cincinnati', 'OH'], ['Toledo', 'OH'], ['Dayton', 'OH'],
  ['Oklahoma City', 'OK'], ['Tulsa', 'OK'], ['Portland', 'OR'], ['Eugene', 'OR'], ['Salem', 'OR'], ['Bend', 'OR'], ['Medford', 'OR'],
  ['Philadelphia', 'PA'], ['Pittsburgh', 'PA'], ['Harrisburg', 'PA'], ['Allentown', 'PA'], ['Lancaster', 'PA'],
  ['Providence', 'RI'], ['Charleston', 'SC'], ['Columbia', 'SC'], ['Greenville', 'SC'], ['Sioux Falls', 'SD'], ['Rapid City', 'SD'],
  ['Nashville', 'TN'], ['Memphis', 'TN'], ['Knoxville', 'TN'], ['Chattanooga', 'TN'],
  ['Houston', 'TX'], ['Dallas', 'TX'], ['Austin', 'TX'], ['San Antonio', 'TX'], ['Fort Worth', 'TX'], ['El Paso', 'TX'],
  ['Lubbock', 'TX'], ['Amarillo', 'TX'], ['Waco', 'TX'], ['Salt Lake City', 'UT'], ['Provo', 'UT'], ['Saint George', 'UT'],
  ['Burlington', 'VT'], ['Richmond', 'VA'], ['Virginia Beach', 'VA'], ['Roanoke', 'VA'], ['Charlottesville', 'VA'],
  ['Seattle', 'WA'], ['Spokane', 'WA'], ['Tacoma', 'WA'], ['Olympia', 'WA'], ['Yakima', 'WA'], ['Charleston', 'WV'], ['Morgantown', 'WV'],
  ['Milwaukee', 'WI'], ['Madison', 'WI'], ['Green Bay', 'WI'], ['Cheyenne', 'WY'], ['Casper', 'WY'],
];

// How each name reads on the page (the geocoder wants "Saint").
export const DISPLAY: Record<string, string> = { 'Saint Paul': 'St. Paul', 'Saint Louis': 'St. Louis', 'Saint George': 'St. George' };
// Places the geocoder can't pin by name alone.
export const COORD_OVERRIDE: Record<string, [number, number]> = { 'Washington,DC': [38.9072, -77.0369] };
