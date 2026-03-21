export interface Question {
  id: number
  category: 'legea544' | 'institutii' | 'practic'
  categoryLabel: string
  text: string
  options: string[]
  correctIndex: number
  explanation: string
}

export const questions: Question[] = [
  // === Categoria 1: Legea 544/2001 ===
  {
    id: 1,
    category: 'legea544',
    categoryLabel: 'Legea 544/2001',
    text: 'Ce reglementează Legea 544/2001?',
    options: [
      'Protecția datelor personale',
      'Liberul acces la informațiile de interes public',
      'Organizarea administrației publice locale',
      'Dreptul la petiționare',
    ],
    correctIndex: 1,
    explanation:
      'Legea 544/2001 garantează accesul oricărei persoane la informațiile de interes public deținute de autoritățile și instituțiile publice.',
  },
  {
    id: 2,
    category: 'legea544',
    categoryLabel: 'Legea 544/2001',
    text: 'În câte zile lucrătoare trebuie să răspundă o instituție publică la o cerere de informații publice?',
    options: ['5 zile', '10 zile', '15 zile', '30 zile'],
    correctIndex: 1,
    explanation:
      'Termenul standard este de 10 zile lucrătoare, cu posibilitate de prelungire la 30 de zile pentru cereri complexe.',
  },
  {
    id: 3,
    category: 'legea544',
    categoryLabel: 'Legea 544/2001',
    text: 'Cine poate depune o cerere de informații publice conform Legii 544?',
    options: [
      'Doar cetățenii români',
      'Doar jurnaliștii acreditați',
      'Doar ONG-urile înregistrate',
      'Orice persoană, fără a justifica un interes',
    ],
    correctIndex: 3,
    explanation:
      'Legea nu condiționează accesul de cetățenie, profesie sau demonstrarea unui interes. Oricine poate cere.',
  },
  {
    id: 4,
    category: 'legea544',
    categoryLabel: 'Legea 544/2001',
    text: 'Ce poți face dacă o instituție refuză să îți ofere informațiile cerute?',
    options: [
      'Nimic, decizia este definitivă',
      'Poți depune reclamație administrativă și apoi acțiune în instanță',
      'Poți doar să depui o petiție la Parlament',
      'Trebuie să aștepți un an și să reîncerci',
    ],
    correctIndex: 1,
    explanation:
      'Ai dreptul la reclamație administrativă (în 30 de zile) la conducătorul instituției, iar dacă nu se rezolvă, poți merge în instanță.',
  },
  {
    id: 5,
    category: 'legea544',
    categoryLabel: 'Legea 544/2001',
    text: 'Care dintre următoarele NU este informație de interes public?',
    options: [
      'Bugetul unei primării',
      'Salariile directorilor din instituții publice',
      'Dosarul medical al unui funcționar public',
      'Contractele de achiziții publice',
    ],
    correctIndex: 2,
    explanation:
      'Datele personale privind sănătatea sunt protejate. Bugetul, salariile din bani publici și contractele sunt informații publice.',
  },

  // === Categoria 2: Instituții și competențe ===
  {
    id: 6,
    category: 'institutii',
    categoryLabel: 'Instituții și competențe',
    text: 'Cui te adresezi dacă vrei să afli bugetul unei școli publice?',
    options: [
      'Ministerului Educației',
      'Inspectoratului Școlar Județean',
      'Primăriei (ca finanțator) sau direct școlii',
      'Prefecturii',
    ],
    correctIndex: 2,
    explanation:
      'Școlile publice sunt finanțate din bugetul local. Poți cere informații direct școlii sau primăriei care o finanțează.',
  },
  {
    id: 7,
    category: 'institutii',
    categoryLabel: 'Instituții și competențe',
    text: 'Ce instituție verifică legalitatea actelor administrative ale primarilor?',
    options: [
      'Consiliul Județean',
      'Curtea de Conturi',
      'Prefectura (prin controlul de legalitate)',
      'Ministerul de Interne',
    ],
    correctIndex: 2,
    explanation:
      'Prefectul exercită controlul de legalitate asupra actelor administrative ale autorităților locale.',
  },
  {
    id: 8,
    category: 'institutii',
    categoryLabel: 'Instituții și competențe',
    text: 'Unde depui o plângere dacă un funcționar public refuză nejustificat să îți dea informații?',
    options: [
      'La Poliție',
      'La Parchet',
      'La Curtea Constituțională',
      'La tribunalul în raza căruia se află instituția',
    ],
    correctIndex: 3,
    explanation:
      'Conform Legii 544, acțiunea în instanță se depune la secția de contencios administrativ a tribunalului competent.',
  },
  {
    id: 9,
    category: 'institutii',
    categoryLabel: 'Instituții și competențe',
    text: 'Care instituție auditează modul în care sunt cheltuiți banii publici?',
    options: [
      'Agenția Națională de Integritate',
      'Curtea de Conturi',
      'Autoritatea de Supraveghere Financiară',
      'Ministerul Finanțelor',
    ],
    correctIndex: 1,
    explanation:
      'Curtea de Conturi este instituția care verifică formarea, administrarea și utilizarea resurselor financiare publice.',
  },
  {
    id: 10,
    category: 'institutii',
    categoryLabel: 'Instituții și competențe',
    text: 'Cine numește prefectul unui județ?',
    options: [
      'Consiliul Județean',
      'Cetățenii prin vot direct',
      'Președintele României',
      'Guvernul',
    ],
    correctIndex: 3,
    explanation:
      'Prefectul este reprezentantul Guvernului la nivel local și este numit prin hotărâre de Guvern.',
  },

  // === Categoria 3: Situații practice ===
  {
    id: 11,
    category: 'practic',
    categoryLabel: 'Situații practice',
    text: 'Vrei să știi câți bani a cheltuit primăria pe iluminat public anul trecut. Ce faci?',
    options: [
      'Suni la primărie și întrebi informal',
      'Aștepți raportul anual de activitate',
      'Depui o cerere scrisă de informații publice conform Legii 544',
      'Faci o petiție online pe platforma guvernului',
    ],
    correctIndex: 2,
    explanation:
      'O cerere scrisă conform Legii 544 obligă instituția să răspundă în termen legal. Informal, nimeni nu e obligat să-ți răspundă.',
  },
  {
    id: 12,
    category: 'practic',
    categoryLabel: 'Situații practice',
    text: 'Ai depus o cerere de informații publice acum 15 zile lucrătoare și nu ai primit niciun răspuns. Ce drept ai?',
    options: [
      'Nu ai niciun drept, trebuie să aștepți',
      'Poți doar să depui altă cerere',
      'Poți depune reclamație administrativă la conducătorul instituției',
      'Trebuie să contactezi un avocat obligatoriu',
    ],
    correctIndex: 2,
    explanation:
      'Dacă termenul de 10 zile a fost depășit, poți depune reclamație administrativă. Nu ai nevoie de avocat pentru asta.',
  },
  {
    id: 13,
    category: 'practic',
    categoryLabel: 'Situații practice',
    text: 'O primărie îți spune că informația cerută este „secret de serviciu". Ce ar trebui să știi?',
    options: [
      'Trebuie să accepți și să renunți',
      'Clasificarea trebuie justificată legal; poți contesta decizia',
      'Informațiile clasificate nu pot fi niciodată accesate',
      'Doar jurnaliștii pot contesta clasificarea',
    ],
    correctIndex: 1,
    explanation:
      'Instituția trebuie să indice temeiul legal al clasificării. Dacă nu e justificat, poți contesta la conducător și apoi în instanță.',
  },
  {
    id: 14,
    category: 'practic',
    categoryLabel: 'Situații practice',
    text: 'Vrei să participi la ședința consiliului local. Ce este corect?',
    options: [
      'Ședințele sunt întotdeauna închise publicului',
      'Poți participa doar dacă ai o cerere pe ordinea de zi',
      'Ședințele consiliului local sunt publice și oricine poate participa',
      'Doar consilierii și primarul pot fi prezenți',
    ],
    correctIndex: 2,
    explanation:
      'Conform legii administrației publice locale, ședințele consiliului local sunt publice. Cetățenii pot asista.',
  },
  {
    id: 15,
    category: 'practic',
    categoryLabel: 'Situații practice',
    text: 'Un prieten îți spune că a cerut informații publice și i s-a cerut să plătească 500 lei „taxă de procesare". Ce e corect?',
    options: [
      'E normal, informația costă',
      'Taxa depinde de instituție',
      'Doar copiile costă 500 lei',
      'Accesul la informații publice este gratuit; se pot percepe doar costurile de copiere',
    ],
    correctIndex: 3,
    explanation:
      'Legea 544 prevede gratuitatea accesului. Instituția poate percepe doar costul efectiv al copierii documentelor, nu „taxe de procesare".',
  },
]
