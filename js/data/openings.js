// Öppningar att lära sig. `side` = sidan du tränar som. `notes` = kommentar efter ett visst halvdrag (index från 0).

export const OPENINGS = [
  {
    id: 'italienskt', name: 'Italienskt parti', eco: 'C50', side: 'w', level: 'Nybörjare',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
    summary: 'En av de äldsta och mest logiska öppningarna. Vit utvecklar snabbt och siktar på den svaga f7-bonden.',
    ideas: ['Utveckla springare före löpare', 'Löparen på c4 tittar mot f7', 'c3 förbereder d4 och ett starkt centrum', 'Rocka tidigt för kungssäkerhet'],
    notes: { 0: 'Ta centrum och öppna vägen för dam och löpare.', 2: 'Utveckla och anfall e5.', 4: 'Löparen siktar mot f7 – svarts svagaste punkt.', 6: 'Förbereder d4 och ger löparen en reträtt till c2.', 8: 'Lugnt och solitt (Giuoco Pianissimo).', 10: 'Kungen i säkerhet – nu kan mittspelet börja.' },
  },
  {
    id: 'spanskt', name: 'Spanskt parti', eco: 'C84', side: 'w', level: 'Medel',
    moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O',
    summary: 'Ruy Lopez – stormästarnas favorit. Vit sätter långsiktig press på e5 genom att angripa springaren som försvarar den.',
    ideas: ['Bb5 angriper försvararen av e5', 'Löparen backar till b3 och siktar mot f7', 'Re1 skyddar e4', 'c3 och d4 bygger ett stort centrum'],
    notes: { 4: 'Angriper springaren som försvarar e5.', 5: 'Morphy-draget: fråga löparen direkt.', 8: 'Rocka – e4 är indirekt skyddad.', 10: 'Tornet skyddar e4 och förbereder Bxc6 följt av Nxe5.', 14: 'Förbereder d4 och skapar en reträttruta på c2.' },
  },
  {
    id: 'skotskt', name: 'Skotskt parti', eco: 'C45', side: 'w', level: 'Medel',
    moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4',
    summary: 'Vit öppnar centrum direkt med d4. Öppet spel med tydliga planer – bra för den som gillar aktivitet.',
    ideas: ['d4 öppnar spelet direkt', 'Byt på c6 för att skapa en dubbelbonde', 'e5 jagar springaren', 'c4 tar bort d5-rutan från svart'],
    notes: { 4: 'Utmanar centrum direkt.', 8: 'Mieses-varianten: skapa dubbelbönder.', 10: 'Jagar springaren från f6.', 14: 'Springaren på d5 måste flytta igen.' },
  },
  {
    id: 'london', name: 'Londonsystemet', eco: 'D02', side: 'w', level: 'Nybörjare',
    moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
    summary: 'Ett system du kan spela mot nästan allt. Samma uppställning varje gång – perfekt för att slippa plugga mycket teori.',
    ideas: ['Löparen ut till f4 innan e3', 'Pyramid av bönder: c3–d4–e3', 'Bg3 för att möta Bd6 utan att få förstörd struktur', 'Sikta på kungsangrepp med Ne5 och Qf3/h4'],
    notes: { 2: 'Löparen ut före e3 så att den inte stängs in.', 4: 'Solid bondekedja.', 8: 'Stöttar d4 – bondepyramiden är klar.', 12: 'Om svart byter på g3 öppnas h-linjen för ditt torn.' },
  },
  {
    id: 'damgambit', name: 'Damgambit avböjt', eco: 'D58', side: 'w', level: 'Medel',
    moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
    summary: 'Klassisk positionell öppning. Vit erbjuder c-bonden för att vinna kampen om centrum.',
    ideas: ['c4 utmanar d5', 'Bg5 binder springaren som försvarar d5', 'Svart är solitt men lite trångt', 'Minoritetsangrepp med b4–b5 är en typisk plan'],
    notes: { 2: 'Gambiten – men svart kan inte riktigt behålla bonden.', 3: 'Avböjt: svart stöttar d5.', 6: 'Binder springaren på f6.', 13: 'Tartakower-varianten: löparen ska till b7.' },
  },
  {
    id: 'engelskt', name: 'Engelskt parti', eco: 'A29', side: 'w', level: 'Avancerad',
    moves: 'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O Be7',
    summary: 'Ett omvänt sicilianskt. Vit kontrollerar centrum från flanken med löparen på den långa diagonalen.',
    ideas: ['c4 kontrollerar d5', 'Fianchetto: Bg2 på den långa diagonalen', 'Tryck mot svarts damflygel', 'Flexibelt – ofta övergångar till andra öppningar'],
    notes: { 0: 'Kontrollerar d5 från sidan.', 4: 'Förbereder fianchetto.', 8: 'Löparen trycker mot springaren på d5 och damflygeln.' },
  },
  {
    id: 'siciliansk', name: 'Sicilianskt försvar (Najdorf)', eco: 'B90', side: 'b', level: 'Avancerad',
    moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
    summary: 'Det skarpaste svaret mot 1.e4. Svart skapar en obalanserad ställning och spelar för vinst.',
    ideas: ['c5 kämpar om d4 från flanken', 'Byt c-bonden mot vits d-bonde – två centrumbönder kvar', 'a6 förhindrar Nb5 och förbereder b5', 'Halvöppen c-linje för tornen'],
    notes: { 1: 'Kämpar om d4 utan att spegla vit.', 5: 'Byter flankbonde mot centrumbonde.', 7: 'Angriper e4 med tempo.', 9: 'Najdorf: flexibelt, förbereder e5 eller e6 och b5.' },
  },
  {
    id: 'franskt', name: 'Franskt försvar', eco: 'C14', side: 'b', level: 'Medel',
    moves: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O',
    summary: 'Solitt och strategiskt. Svart låter vit ta plats men angriper bondekedjan senare med c5 och f6.',
    ideas: ['e6 + d5 utmanar e4', 'Angrip vits bondekedja vid basen med c5', 'Den "dåliga" löparen på c8 är svarts största problem', 'f6 bryter upp vits centrum'],
    notes: { 1: 'Förbereder d5.', 3: 'Utmanar e4 direkt.', 9: 'Springaren backar och förbereder c5.', 13: 'Kungen i säkerhet. Nästa steg: c5!' },
  },
  {
    id: 'carokann', name: 'Caro-Kann', eco: 'B18', side: 'b', level: 'Nybörjare',
    moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7',
    summary: 'Ett mycket solitt försvar. Svart får ut sin damlöpare innan e6 och får en sund bondestruktur.',
    ideas: ['c6 förbereder d5', 'Löparen ut till f5 innan e6', 'Sund bondestruktur utan svagheter', 'Bra slutspel för svart'],
    notes: { 1: 'Förbereder d5 utan att stänga in löparen.', 7: 'Löparen kommer ut före e6 – Caro-Kanns stora idé.', 11: 'Ge löparen en reträtt så att den inte fångas med h5.', 15: 'Löparen är säker på h7.' },
  },
  {
    id: 'skandinaviskt', name: 'Skandinaviskt försvar', eco: 'B01', side: 'b', level: 'Nybörjare',
    moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bc4 e6',
    summary: 'Svart utmanar e4 direkt i första draget. Enkelt att lära sig och ger snabb utveckling.',
    ideas: ['d5 utmanar e4 direkt', 'Damen till a5 – säker men aktiv', 'Löparen ut till f5', 'Bondestruktur som i Caro-Kann'],
    notes: { 1: 'Direkt utmaning av e4.', 5: 'Damen undviker tempoförlust och binder c3-springaren.', 9: 'Löparen ut innan e6.' },
  },
  {
    id: 'slaviskt', name: 'Slaviskt försvar', eco: 'D17', side: 'b', level: 'Medel',
    moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O',
    summary: 'Ett pålitligt svar mot damgambiten. Svart håller d5 med c6 och behåller den ljusa löparen aktiv.',
    ideas: ['c6 stöttar d5', 'Ta på c4 när vit inte kan hålla den', 'Löparen ut till f5', 'Bb4 ger press mot c3'],
    notes: { 3: 'Stöttar d5 utan att stänga in löparen.', 7: 'Tar bonden när vit spelat Nc3.', 9: 'Löparen ut aktivt.' },
  },
  {
    id: 'kungsindiskt', name: 'Kungsindiskt försvar', eco: 'E97', side: 'b', level: 'Avancerad',
    moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
    summary: 'Svart låter vit bygga ett stort centrum och kontrar sedan med ett kungsangrepp. Dynamiskt och skarpt.',
    ideas: ['Fianchetto med Bg7', 'Rocka tidigt', 'e5 utmanar centrum', 'När vit stänger med d5: angrip med f5 på kungsflygeln'],
    notes: { 5: 'Löparen på den långa diagonalen.', 11: 'Svarts stora utmaning av centrum.', 15: 'Springaren går mot kungsflygeln. Nästa: Nd7/Ne8 och f5!' },
  },
  // ----- Fällor -----
  {
    id: 'herdematt', name: 'Försvar mot herdematt', eco: 'C20', side: 'b', level: 'Nybörjare', trap: true,
    moves: 'e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6',
    summary: 'Herdematten (Qxf7#) är den vanligaste fällan bland nybörjare. Lär dig stoppa den – och straffa vits tidiga damutflykt.',
    ideas: ['Damen på h5 hotar Qxf7#', 'g6 blockerar och angriper damen', 'Nf6 utvecklar och stoppar Qxf7', 'Svart vinner tempo på damen'],
    notes: { 4: 'Hotar Qxf7# och samtidigt e5!', 5: 'Stoppar matten och angriper damen.', 6: 'Nytt hot mot f7.', 7: 'Försvarar f7 med tempo-utveckling. Svart står bra!' },
  },
  {
    id: 'legal', name: 'Legals matt', eco: 'C41', side: 'w', level: 'Nybörjare', trap: true,
    moves: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#',
    summary: 'En klassisk fälla där vit offrar damen för att matta med tre lätta pjäser. Visar varför man inte ska binda för tidigt.',
    ideas: ['Bindningen Bg4 är en illusion', 'Nxe5 offrar damen', 'Tre lätta pjäser mattar kungen', 'Lärdom: utveckla innan du jagar material'],
    notes: { 8: 'Damoffret! Om svart tar damen blir det matt.', 10: 'Kungen tvingas fram.', 12: 'Matt med tre lätta pjäser!' },
  },
  {
    id: 'englund', name: 'Englundgambitens fälla', eco: 'A40', side: 'b', level: 'Nybörjare', trap: true,
    moves: 'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4 Qd2 Bxc3 Qxc3 Qc1#',
    summary: 'En svensk specialitet! Englundgambiten är uppkallad efter Fritz Englund. Om vit är girig slutar det med matt.',
    ideas: ['Qe7 hotar att vinna tillbaka e5', 'Qb4+ med dubbelangrepp mot b2', 'Bb4 binder löparen', 'Matt på c1'],
    notes: { 7: 'Schack och samtidigt angrepp på b2.', 11: 'Binder löparen mot damen.', 15: 'Matt! Kungen är instängd av sina egna pjäser.' },
  },
];

/** Bok-ställningar (placering + sida vid draget) från alla öppningsvarianter. */
export function bookSet(Chess) {
  const set = new Set();
  for (const o of OPENINGS) {
    const c = new Chess();
    for (const san of o.moves.split(' ')) {
      try {
        c.move(san);
        set.add(c.fen().split(' ').slice(0, 2).join(' '));
      } catch {
        console.warn('Ogiltigt drag i öppning', o.id, san);
        break;
      }
    }
  }
  return set;
}

/** Hittar den längsta öppning som matchar partiets början. */
export function detectOpening(sanMoves) {
  let best = null;
  let bestLen = 1;
  for (const o of OPENINGS) {
    if (o.trap) continue;
    const m = o.moves.split(' ');
    let n = 0;
    while (n < m.length && n < sanMoves.length && m[n] === sanMoves[n]) n++;
    if (n > bestLen) { best = o; bestLen = n; }
  }
  return best;
}
