// Klassiska mattmönster. Antingen `fen` eller `moves` (drag från utgångsställningen) anger startställningen.
// `solution` är huvudvarianten i SAN; dragen för motståndaren spelas automatiskt.

export const MATES = [
  {
    id: 'bakrad', name: 'Bakre radens matt', n: 1,
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    solution: ['Ra8#'],
    text: 'Kungen är instängd av sina egna bönder. Ett torn eller en dam på bakre raden mattar. Därför gör man ofta "luft" med h6 eller g6.',
  },
  {
    id: 'kyss', name: 'Kyssmatt', n: 1,
    fen: '6k1/5ppp/8/8/6Q1/8/1B3PPP/6K1 w - - 0 1',
    solution: ['Qxg7#'],
    text: 'Damen ställer sig precis bredvid kungen, skyddad av en annan pjäs – här löparen på den långa diagonalen.',
  },
  {
    id: 'herde', name: 'Herdematt', n: 1,
    moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6',
    solution: ['Qxf7#'],
    text: 'Dam och löpare slår till på f7, svarts svagaste ruta som bara kungen försvarar. Svart borde ha spelat g6 eller Qe7.',
  },
  {
    id: 'trappa', name: 'Trappmatt', n: 1,
    fen: '3k4/R7/8/8/8/8/8/1R4K1 w - - 0 1',
    solution: ['Rb8#'],
    text: 'Två torn tar varannan rad och knuffar kungen mot kanten som en trappa. Ett torn spärrar, det andra ger schack.',
  },
  {
    id: 'arabisk', name: 'Arabisk matt', n: 1,
    fen: '7k/4R3/5N2/8/8/8/6PP/6K1 w - - 0 1',
    solution: ['Rh7#'],
    text: 'Ett av de äldsta kända mattmönstren. Springaren skyddar tornet och täcker g8, tornet ger matt i hörnet.',
  },
  {
    id: 'epaulett', name: 'Epaulettmatt', n: 1,
    fen: '3rkr2/pp4pp/8/8/2Q5/8/PP4PP/6K1 w - - 0 1',
    solution: ['Qe6#'],
    text: 'Kungens egna torn står som axelklaffar (epåletter) på båda sidor och tar bort flyktrutorna.',
  },
  {
    id: 'kvavning', name: 'Kvävningsmatt (Philidors arv)', n: 2,
    fen: '3r3k/6pp/7N/8/2Q5/8/6PP/6K1 w - - 0 1',
    solution: ['Qg8+', 'Rxg8', 'Nf7#'],
    text: 'Damoffret tvingar tornet till g8 och kungen kvävs av sina egna pjäser. Springaren ger matt – en av schackets vackraste matter.',
  },
  {
    id: 'anastasia', name: 'Anastasias matt', n: 2,
    fen: 'r6k/4N1pp/8/7Q/8/5R2/5PPP/6K1 w - - 0 1',
    solution: ['Qxh7+', 'Kxh7', 'Rh3#'],
    text: 'Springaren på e7 täcker g6 och g8. Efter damoffret mattar tornet längs h-linjen.',
  },
  {
    id: 'boden', name: 'Bodens matt', n: 2,
    fen: '2kr4/pp1n4/2n5/8/5B2/5Q2/PPP2PPP/4KB2 w - - 0 1',
    solution: ['Qxc6+', 'bxc6', 'Ba6#'],
    text: 'Två löpare på korsande diagonaler mattar en kung som rockat långt. Damoffret öppnar diagonalen.',
  },
  {
    id: 'legal', name: 'Legals matt', n: 2,
    moves: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1',
    solution: ['Bxf7+', 'Ke7', 'Nd5#'],
    text: 'Svart tog damen men tre lätta pjäser är starkare än damen här. Kungen har ingenstans att ta vägen.',
  },
  {
    id: 'opera', name: 'Operamatt (Morphy, 1858)', n: 2,
    moves: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7',
    solution: ['Qb8+', 'Nxb8', 'Rd8#'],
    text: 'Paul Morphys berömda parti på operan i Paris. Damoffret Qb8+ och tornet mattar med stöd av löparen på g5.',
  },
];
