/** Offline word -> emoji for common nouns the hand-drawn library does not cover. Anything else asks the shape service. */
export const EMOJI_WORDS: Record<string, string> = {
  // Animals & Nature
  dog: '🐕', puppy: '🐶', cat: '🐈', kitten: '🐱', pet: '🐾',
  zebra: '🦓', dragon: '🐉', dinosaur: '🦖', lion: '🦁', tiger: '🐯', elephant: '🐘', giraffe: '🦒', monkey: '🐒', bear: '🐻', panda: '🐼',
  fox: '🦊', wolf: '🐺', rabbit: '🐰', horse: '🐴', unicorn: '🦄', cow: '🐮', pig: '🐷', sheep: '🐑', chicken: '🐔', duck: '🦆', owl: '🦉',
  eagle: '🦅', penguin: '🐧', fish: '🐟', shark: '🦈', whale: '🐋', dolphin: '🐬', octopus: '🐙', crab: '🦀', turtle: '🐢', frog: '🐸',
  snake: '🐍', bee: '🐝', ant: '🐜', spider: '🕷️', snail: '🐌', ladybug: '🐞', bird: '🐦', butterfly: '🦋',
  
  // Food & Drinks
  coffee: '☕', espresso: '☕', latte: '☕', cappuccino: '☕', caffeine: '☕',
  tea: '🍵', matcha: '🍵', chai: '🍵', teapot: '🫖', water: '💧', juice: '🧃', smoothie: '🥤',
  apple: '🍎', banana: '🍌', pineapple: '🍍', strawberry: '🍓', watermelon: '🍉', lemon: '🍋', cherry: '🍒', grapes: '🍇', avocado: '🥑',
  carrot: '🥕', broccoli: '🥦', burger: '🍔', fries: '🍟', taco: '🌮', sushi: '🍣', pizza: '🍕', sandwich: '🥪',
  bread: '🍞', cheese: '🧀', egg: '🥚', cupcake: '🧁', cake: '🎂', cookie: '🍪', icecream: '🍦', chocolate: '🍫',
  popcorn: '🍿', wine: '🍷', beer: '🍺', cocktail: '🍸', dinner: '🍽️', lunch: '🍱', breakfast: '🍳', snack: '🥨',

  // Tech, Work & Digital
  laptop: '💻', computer: '🖥️', pc: '🖥️', mac: '💻', desktop: '🖥️',
  phone: '📱', mobile: '📱', iphone: '📱', smartphone: '📱', call: '📞', text: '💬', message: '💬', chat: '💬',
  code: '💻', coding: '💻', programming: '💻', developer: '👨‍💻', software: '💻', terminal: '💻', bug: '🪲',
  email: '✉️', mail: '📧', inbox: '📥', send: '📤', letter: '✉️',
  book: '📖', books: '📚', reading: '📖', study: '📚', homework: '📝', assignment: '📝', paper: '📄', essay: '📝',
  write: '✍️', writing: '✍️', pen: '🖊️', pencil: '✏️', note: '📝', notes: '🗒️', document: '📄',
  money: '💰', cash: '💵', dollar: '💵', bank: '🏦', wallet: '👛', budget: '💳', bill: '🧾', bills: '🧾', pay: '💳', crypto: '🪙',

  // Health, Fitness & Routine
  gym: '🏋️', workout: '💪', exercise: '🏃', fitness: '🏋️', weights: '🏋️', lifting: '🏋️', barbell: '🏋️',
  run: '🏃', running: '🏃', jog: '🏃', cardio: '🏃',
  walk: '🚶', walking: '🚶', stroll: '🚶', hike: '🥾', hiking: '🥾', yoga: '🧘', stretch: '🧘',
  sleep: '🛌', nap: '😴', bed: '🛏️', rest: '🛌', pillow: '🛌',
  clean: '🧹', cleaning: '🧹', tidy: '✨', broom: '🧹', sweep: '🧹', vacuum: '🧹',
  laundry: '🧺', clothes: '👕', shirt: '👕', pants: '👖', shoes: '👟', wash: '🧼', washing: '🧼',
  dishes: '🍽️', dishwasher: '🍽️', trash: '🗑️', garbage: '🗑️', shower: '🚿', bath: '🛁', tooth: '🦷', toothbrush: '🪥',

  // Transport & Travel
  car: '🚗', drive: '🚗', traffic: '🚦', bus: '🚌', train: '🚆', metro: '🚇',
  plane: '✈️', airplane: '✈️', flight: '✈️', airport: '🛫', helicopter: '🚁', boat: '⛵', ship: '🚢',
  bicycle: '🚲', bike: '🚲', motorcycle: '🏍️', scooter: '🛴', truck: '🚚', tractor: '🚜', ambulance: '🚑', taxi: '🚕',
  travel: '🧳', trip: '✈️', hotel: '🏨', passport: '🛂', ticket: '🎫', map: '🗺️', compass: '🧭',

  // Leisure & Creativity
  music: '🎵', song: '🎶', sound: '🔊', listen: '🎧', headphones: '🎧', airpods: '🎧',
  guitar: '🎸', violin: '🎻', drum: '🥁', trumpet: '🎺', microphone: '🎤', piano: '🎹',
  game: '🎮', gaming: '🎮', play: '🎮', controller: '🎮', nintendo: '🎮', playstation: '🎮', xbox: '🎮',
  art: '🎨', draw: '🎨', drawing: '🎨', paint: '🎨', painting: '🎨', camera: '📷', photo: '📸', video: '🎥', movie: '🎬', film: '🎞️',
  tv: '📺', television: '📺', podcast: '🎙️', radio: '📻', dance: '💃', party: '🎉', celebration: '🥳',

  // Household & Objects
  house: '🏠', home: '🏡', apartment: '🏢', room: '🚪', door: '🚪', window: '🪟', chair: '🪑', couch: '🛋️', table: '🪵',
  lamp: '💡', light: '💡', bulb: '💡', candle: '🕯️', clock: '⏰', alarm: '⏰', timer: '⏱️', stopwatch: '⏱️', calendar: '📅',
  box: '📦', package: '📦', parcel: '📦', bag: '🎒', backpack: '🎒', key: '🔑', keys: '🔑', lock: '🔒', umbrella: '☂️', glasses: '👓',
  scissors: '✂️', hammer: '🔨', wrench: '🔧', tool: '🛠️', tools: '🛠️', magnet: '🧲', battery: '🔋', plug: '🔌',
  shopping: '🛒', cart: '🛒', store: '🏪', market: '🏬', gift: '🎁', present: '🎁', balloon: '🎈',

  // Nature & Weather
  sun: '☀️', sunny: '☀️', moon: '🌙', night: '🌙', star: '⭐', stars: '✨', cloud: '☁️', rain: '🌧️', storm: '⛈️',
  snow: '❄️', snowflake: '❄️', rainbow: '🌈', fire: '🔥', flame: '🔥', tree: '🌳', flower: '🌸', rose: '🌹', leaf: '🍃',
  mountain: '⛰️', beach: '🏖️', ocean: '🌊', wave: '🌊', island: '🏝️', earth: '🌍', space: '🌌', rocket: '🚀',

  // Emotions & Focus
  happy: '😊', joy: '😄', smile: '😃', laugh: '😂',
  sad: '😢', cry: '😭', upset: '😔', overwhelmed: '😵‍💫', anxiety: '😰', panic: '😱',
  stress: '😫', angry: '😤', calm: '😌', peaceful: '🕊️', focus: '🎯', target: '🎯',
  brain: '🧠', heart: '❤️', spark: '✨', magic: '🪄', trophy: '🏆', medal: '🏅', check: '✅', cross: '❌',
};
