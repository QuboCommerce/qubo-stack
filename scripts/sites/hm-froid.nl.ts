/**
 * HM Froid in Dutch (nl-BE). Keyed by the French master string, so the build
 * script can overlay every document it finds without knowing node ids. The
 * register is Belgian Dutch for a trade audience: "horeca", "frituur",
 * "diepvries", "beenhouwerij", "btw excl.", no wordplay.
 */

export const nlPages: Record<string, { slug: string; title: string; metaTitle?: string; metaDescription: string }> = {
  "qui-sommes-nous": {
    slug: "over-ons",
    title: "Over ons",
    metaDescription: "HM Froid verkoopt nieuw en tweedehands horecamateriaal in Anderlecht sinds 2008. Showroom, atelier, levering in heel België en overname van materiaal.",
  },
  contact: {
    slug: "contact",
    title: "Contact",
    metaTitle: "Contact en showroom in Anderlecht",
    metaDescription: "Showroom HM Froid, Raymond Vanderbruggenlaan 18-20, 1070 Anderlecht. +32 2 411 80 02. Ma-vr 9u-18u, za 10u-16u. Offertes en advies voor uw horecamateriaal.",
  },
  "livraison-et-paiement": {
    slug: "levering-en-betaling",
    title: "Levering en betaling",
    metaTitle: "Levering in België en betaling",
    metaDescription: "Verzekerde levering in heel België, gratis vanaf 1 500 € excl. btw. Tarieven per provincie, afhaling in het magazijn, voorschot en betaalmiddelen.",
  },
  "garantie-et-sav": {
    slug: "garantie-en-dienst-na-verkoop",
    title: "Garantie en dienst na verkoop",
    metaTitle: "Garantie en dienst na verkoop horecamateriaal",
    metaDescription: "1 jaar garantie op nieuw, 6 maanden op tweedehands. Interventies van maandag tot vrijdag, onderdelen en advies. Wat de garantie dekt en wat niet.",
  },
  "mentions-legales": {
    slug: "wettelijke-vermeldingen",
    title: "Wettelijke vermeldingen",
    metaDescription: "Uitgever van hmfroid.be: H.M. Catering Equipment nv, Anderlecht. Ondernemingsnummer, contactgegevens en hosting.",
  },
  "politique-de-confidentialite": {
    slug: "privacybeleid",
    title: "Privacybeleid",
    metaDescription: "Welke gegevens HM Froid via de site verzamelt, waarom, hoelang ze bewaard worden en hoe u uw rechten uitoefent.",
  },
  "conditions-generales": {
    slug: "algemene-voorwaarden",
    title: "Algemene verkoopvoorwaarden",
    metaDescription: "Verkoopvoorwaarden HM Froid: offertes, voorschot van 40 %, termijnen, levering, eigendomsvoorbehoud, garantie en geschillen.",
  },
  "questions-frequentes": {
    slug: "veelgestelde-vragen",
    title: "Veelgestelde vragen",
    metaTitle: "Veelgestelde vragen over de aankoop van horecamateriaal",
    metaDescription: "Verkoop aan particulieren, installatie, garantie, termijnen, levering, tweedehands, overname: de antwoorden van HM Froid voor u koopt.",
  },
  "materiel-horeca-occasion": {
    slug: "tweedehands-horecamateriaal",
    title: "Tweedehands horecamateriaal",
    metaTitle: "Tweedehands horecamateriaal, nagekeken en gewaarborgd",
    metaDescription: "Tweedehands koelkasten, koelwerkbanken, fornuizen en inox, nagekeken in ons atelier en 6 maanden gewaarborgd. Wekelijks nieuwe voorraad in Anderlecht.",
  },
  "rachat-materiel-horeca": {
    slug: "overname-horecamateriaal",
    title: "Overname van horecamateriaal",
    metaTitle: "Overname van horecamateriaal",
    metaDescription: "Sluit, verbouwt of vervangt u? HM Froid koopt uw keuken-, koel- en kookmateriaal over in heel België. Schatting op foto's, ophaling geregeld.",
  },
  marques: {
    slug: "merken",
    title: "Merken",
    metaTitle: "Verdeelde merken: Bertos, MBM, Robot Coupe, Tefcold",
    metaDescription: "De fabrikanten van horecamateriaal die HM Froid verdeelt: Bertos, MBM, Robot Coupe, Tefcold, Hällde, Henkovac, Santos, Wooster en andere.",
  },
  friterie: {
    slug: "frituur",
    title: "Materiaal voor frituren",
    metaTitle: "Materiaal voor frituren: professioneel, nieuw en tweedehands",
    metaDescription: "Hoogrendementsfriteuses, koelwerkbanken, vitrines en inox voor de frituur. Nieuw en tweedehands materiaal, geleverd in heel België door HM Froid.",
  },
  boucherie: {
    slug: "beenhouwerij",
    title: "Materiaal voor beenhouwerijen",
    metaTitle: "Materiaal voor beenhouwerijen: professioneel, nieuw en tweedehands",
    metaDescription: "Koeltogen, koelcellen, snijmachines, vleesmolens en beenderzagen voor de beenhouwerij. Nieuw en tweedehands bij HM Froid, Anderlecht.",
  },
  restaurant: {
    slug: "restaurant",
    title: "Materiaal voor restaurants",
    metaTitle: "Materiaal voor restaurants: professioneel, nieuw en tweedehands",
    metaDescription: "Fornuizen, ovens, koelwerkbanken, vaatwassers en inox voor restaurants. Nieuw en tweedehands horecamateriaal bij HM Froid in Brussel.",
  },
  "boulangerie-patisserie": {
    slug: "bakkerij-patisserie",
    title: "Materiaal voor bakkerijen en patisserie",
    metaTitle: "Materiaal voor bakkerijen en patisserie: professioneel, nieuw en tweedehands",
    metaDescription: "Koelvitrines, snelkoelers, koelkasten en kloppers voor bakkerij en patisserie. Nieuw en tweedehands bij HM Froid.",
  },
  "plan-du-site": {
    slug: "sitemap",
    title: "Sitemap",
    metaDescription: "Alle pagina's en afdelingen van hmfroid.be op één pagina.",
  },
};

export const nl: Record<string, string> = {
  // ---- header ----
  "HM Froid": "HM Froid",
  "Froid commercial": "Professionele koeling",
  "Armoires réfrigérées négatives": "Diepvrieskasten",
  "Armoires réfrigérées positives": "Koelkasten",
  "Tables réfrigérées": "Koelwerkbanken",
  "Vitrines réfrigérées": "Koelvitrines",
  "Comptoirs réfrigérés": "Koeltogen",
  "Chambres froides": "Koelcellen",
  "Machines à glaçons": "IJsblokjesmachines",
  "Congélateurs bahuts": "Diepvrieskisten",
  "Cellules de refroidissement": "Snelkoelers",
  "Arrières de bar": "Barkoelingen",
  "Caves à vin": "Wijnkasten",
  Cuisson: "Kooktoestellen",
  "Gamme MBM Minima 600": "MBM Minima 600",
  "Gamme MBM Domina 700": "MBM Domina 700",
  "Gamme MBM Domina 900": "MBM Domina 900",
  Friteuses: "Friteuses",
  "Plaques à snacker": "Bakplaten",
  Salamandres: "Salamanders",
  "Bains-marie": "Bain-maries",
  "Crêpières et gaufriers": "Crêpe- en wafelijzers",
  "Marmites et sauteuses": "Kookketels en kantelbraadpannen",
  "Inox neutre": "Inox werkmateriaal",
  Tables: "Werktafels",
  Plonges: "Spoeltafels",
  "Armoires murales": "Wandkasten",
  Étagères: "Rekken",
  Chariots: "Wagens",
  "Armoires chauffantes": "Warmhoudkasten",
  Préparation: "Voorbereiding",
  Trancheuses: "Snijmachines",
  Hachoirs: "Vleesmolens",
  "Coupe-légumes": "Groentesnijders",
  Cutters: "Cutters",
  "Robot-Coupe": "Robot-Coupe",
  "Sous-videuses": "Vacuümmachines",
  Batteurs: "Kloppers",
  "Scies à os": "Beenderzagen",
  "Autres rayons": "Andere afdelingen",
  Fours: "Ovens",
  "Pizzeria et pasta": "Pizzeria en pasta",
  "Grills et toasters": "Grills en toasters",
  "Rôtissoires et gyros": "Rotisseries en gyros",
  Ventilation: "Afzuiging",
  Lavage: "Vaatwas",
  "Cafétéria et bar": "Cafetaria en bar",
  Balances: "Weegschalen",
  Déstockage: "Stockverkoop",
  "Occasions et rachat": "Tweedehands en overname",
  "Matériel d'occasion": "Tweedehands materiaal",
  "Révisé en atelier, garanti 6 mois": "Nagekeken in het atelier, 6 maanden garantie",
  "Neuf à prix réduit, fins de série": "Nieuw aan verlaagde prijs, einde reeks",
  "Rachat de votre matériel": "Overname van uw materiaal",
  "Estimation sur photos, enlèvement organisé": "Schatting op foto's, ophaling geregeld",
  "Rechercher parmi 3 900 produits": "Zoek in 3 900 producten",
  "Mon profil": "Mijn profiel",
  "Demander un devis": "Offerte aanvragen",

  // ---- footer ----
  "Matériel horeca neuf et d'occasion à Anderlecht depuis 2008. Froid commercial, cuisson, inox et préparation pour les professionnels de bouche.":
    "Nieuw en tweedehands horecamateriaal in Anderlecht sinds 2008. Koeling, kooktoestellen, inox en voorbereiding voor voedingsprofessionals.",
  Boutique: "Winkel",
  Occasions: "Tweedehands",
  Métiers: "Vakgebieden",
  Marques: "Merken",
  Friterie: "Frituur",
  Boucherie: "Beenhouwerij",
  Restaurant: "Restaurant",
  "Boulangerie et pâtisserie": "Bakkerij en patisserie",
  Informations: "Informatie",
  "Qui sommes-nous": "Over ons",
  "Livraison et paiement": "Levering en betaling",
  "Garantie et SAV": "Garantie en dienst na verkoop",
  "Rachat de matériel": "Overname van materiaal",
  "Questions fréquentes": "Veelgestelde vragen",
  "Plan du site": "Sitemap",
  Légal: "Wettelijk",
  "Mentions légales": "Wettelijke vermeldingen",
  "Politique de confidentialité": "Privacybeleid",
  "Conditions générales": "Algemene voorwaarden",
  "Avenue Raymond Vanderbruggen 18-20\n1070 Anderlecht (Bruxelles)\nLun-Ven : 9h-18h\nSam : 10h-16h":
    "Raymond Vanderbruggenlaan 18-20\n1070 Anderlecht (Brussel)\nMa-vr: 9u-18u\nZa: 10u-16u",
  "© {year} H.M. Catering Equipment s.a. TVA BE 0859.752.174.": "© {year} H.M. Catering Equipment nv. Btw BE 0859.752.174.",
  "Tous les rayons": "Alle afdelingen",

  // ---- home ----
  "Armoire réfrigérée 3 portes vitrées et vitrine murale réfrigérée noires, froid commercial HM Froid Anderlecht":
    "Zwarte koelkast met 3 glazen deuren en zwarte wandkoelvitrine, professionele koeling HM Froid Anderlecht",
  "Faites défiler": "Scroll verder",
  "Anderlecht, depuis 2008": "Anderlecht, sinds 2008",
  "Matériel horeca professionnel, neuf et d'occasion": "Professioneel horecamateriaal, nieuw en tweedehands",
  "<p>Froid commercial, cuisson, inox et préparation : plus de 3 900 produits pour la restauration, les friteries, les boucheries et les commerces de bouche.</p>":
    "<p>Koeling, kooktoestellen, inox en voorbereiding: meer dan 3 900 producten voor restaurants, frituren, beenhouwerijen en voedingszaken.</p>",
  "Voir le catalogue": "Bekijk de catalogus",
  "Nos rayons": "Onze afdelingen",
  "Tout l'équipement d'une cuisine professionnelle": "Alles voor een professionele keuken",
  "Du neuf garanti et de l'occasion révisée en atelier. Chaque rayon se visite aussi au showroom.":
    "Nieuw met garantie en tweedehands nagekeken in ons atelier. Elke afdeling is ook te bezoeken in de showroom.",
  "<p>Armoires, tables, vitrines, chambres froides, machines à glaçons.</p>": "<p>Koelkasten, koelwerkbanken, vitrines, koelcellen, ijsblokjesmachines.</p>",
  "<p>Fourneaux, friteuses, plaques et gammes modulaires MBM et Bertos.</p>": "<p>Fornuizen, friteuses, bakplaten en modulaire reeksen van MBM en Bertos.</p>",
  "<p>Tables, plonges, étagères et armoires en acier inoxydable.</p>": "<p>Werktafels, spoeltafels, rekken en kasten in roestvrij staal.</p>",
  "<p>Trancheuses, hachoirs, cutters, sous-videuses, Robot-Coupe.</p>": "<p>Snijmachines, vleesmolens, cutters, vacuümmachines, Robot-Coupe.</p>",
  "<p>Fours mixtes, à convection et à pizza.</p>": "<p>Combisteamers, heteluchtovens en pizzaovens.</p>",
  "<p>Hottes, moteurs et filtres pour la cuisine.</p>": "<p>Dampkappen, motoren en filters voor de keuken.</p>",
  "<p>Lave-vaisselle, lave-verres et plonges.</p>": "<p>Vaatwassers, glazenspoelmachines en spoeltafels.</p>",
  "<p>Machines à café, presse-agrumes, arrières de bar.</p>": "<p>Koffiemachines, citruspersen, barkoelingen.</p>",
  "Armoires, tables et vitrines réfrigérées": "Koelkasten, koelwerkbanken en koelvitrines",
  "Tout le froid commercial": "Alle koeling",
  "Le rayon se remplit. Appelez-nous pour le stock du moment.": "De afdeling wordt aangevuld. Bel ons voor de voorraad van het moment.",
  "Cellule de refroidissement rapide Wooster et plaque grill MBM en inox, matériel horeca professionnel HM Froid Bruxelles":
    "Snelkoeler Wooster en inox grillplaat MBM, professioneel horecamateriaal HM Froid Brussel",
  "Neuf et occasion": "Nieuw en tweedehands",
  "Du neuf garanti, de l'occasion révisée": "Nieuw met garantie, tweedehands nagekeken",
  "<p>Le matériel neuf est garanti un an pièces pour un usage professionnel. Les occasions passent par notre atelier avant la vente et sont garanties six mois. Nous reprenons aussi votre ancien matériel.</p>":
    "<p>Nieuw materiaal krijgt één jaar garantie op onderdelen bij professioneel gebruik. Tweedehands toestellen passeren voor de verkoop langs ons atelier en krijgen zes maanden garantie. We nemen ook uw oude materiaal over.</p>",
  "Garantie 1 an sur le neuf, 6 mois sur l'occasion": "1 jaar garantie op nieuw, 6 maanden op tweedehands",
  "Révision en atelier avant chaque vente d'occasion": "Nazicht in het atelier voor elke tweedehandsverkoop",
  "Reprise et rachat de votre matériel actuel": "Overname van uw huidige materiaal",
  "Voir les occasions": "Bekijk de tweedehands",
  "Faire reprendre mon matériel": "Mijn materiaal laten overnemen",
  "Par métier": "Per vakgebied",
  "Équiper votre commerce": "Uw zaak uitrusten",
  "Une sélection par activité, avec les rayons qui comptent pour chacune.": "Een selectie per activiteit, met de afdelingen die ertoe doen.",
  "Friteuses haut rendement, bacs à frites, tables réfrigérées.": "Hoogrendementsfriteuses, frietbakken, koelwerkbanken.",
  "Vitrines, trancheuses, hachoirs, scies à os, chambres froides.": "Koeltogen, snijmachines, vleesmolens, beenderzagen, koelcellen.",
  "Fourneaux, fours, tables réfrigérées, lave-vaisselle, inox.": "Fornuizen, ovens, koelwerkbanken, vaatwassers, inox.",
  "Vitrines, batteurs, armoires et cellules de refroidissement.": "Vitrines, kloppers, koelkasten en snelkoelers.",
  "Comment ça se passe": "Hoe het werkt",
  "De la demande à la mise en service": "Van aanvraag tot ingebruikname",
  Choisir: "Kiezen",
  "En ligne parmi plus de 3 900 références ou au showroom d'Anderlecht, du lundi au samedi.":
    "Online uit meer dan 3 900 referenties of in de showroom in Anderlecht, van maandag tot zaterdag.",
  "Devis et commande": "Offerte en bestelling",
  "Un devis clair, HTVA. Acompte de 40 % à la commande, solde avant la livraison.":
    "Een duidelijke offerte, excl. btw. Voorschot van 40 % bij bestelling, saldo voor de levering.",
  "Livraison ou retrait": "Levering of afhaling",
  "Livraison assurée partout en Belgique, offerte dès 1 500 € HTVA. Retrait au dépôt en semaine.":
    "Verzekerde levering in heel België, gratis vanaf 1 500 € excl. btw. Afhaling in het magazijn op weekdagen.",
  "Service après-vente": "Dienst na verkoop",
  "Atelier et interventions du lundi au vendredi. Pièces et conseils pour la durée de vie du matériel.":
    "Atelier en interventies van maandag tot vrijdag. Onderdelen en advies, zolang het materiaal meegaat.",
  "Avant d'acheter": "Voor u koopt",
  "Vendez-vous aux particuliers ?": "Verkopen jullie aan particulieren?",
  "Non. HM Froid s'adresse aux professionnels : restaurants, friteries, boucheries, boulangeries, collectivités et revendeurs. Les prix sont affichés hors TVA.":
    "Nee. HM Froid richt zich tot professionals: restaurants, frituren, beenhouwerijen, bakkerijen, grootkeukens en verdelers. De prijzen zijn exclusief btw.",
  "Installez-vous le matériel ?": "Installeren jullie het materiaal?",
  "Nous livrons et mettons le matériel à disposition sur place. Le raccordement eau, gaz ou électricité est à prévoir avec votre installateur.":
    "We leveren en zetten het materiaal ter plaatse klaar. De aansluiting op water, gas of elektriciteit regelt u met uw installateur.",
  "Quelle garantie sur une occasion ?": "Welke garantie op tweedehands?",
  "Six mois pour un usage professionnel, après révision en atelier. Le neuf est garanti un an pièces.":
    "Zes maanden bij professioneel gebruik, na nazicht in het atelier. Nieuw materiaal krijgt één jaar garantie op onderdelen.",
  "Peut-on venir voir avant d'acheter ?": "Kunnen we komen kijken voor we kopen?",
  "Oui, le showroom d'Anderlecht est ouvert du lundi au vendredi de 9h à 18h et le samedi de 10h à 16h.":
    "Ja, de showroom in Anderlecht is open van maandag tot vrijdag van 9u tot 18u en op zaterdag van 10u tot 16u.",
  "Une question sur un équipement ?": "Een vraag over een toestel?",
  "<p>Un conseiller vous répond au showroom ou par téléphone, du lundi au samedi.</p>": "<p>Een adviseur helpt u verder in de showroom of aan de telefoon, van maandag tot zaterdag.</p>",
  "Appeler le +32 2 411 80 02": "Bel +32 2 411 80 02",
  "Écrire un message": "Stuur een bericht",

  // ---- collection and product templates ----
  Accueil: "Home",
  "{n} produits": "{n} producten",
  "Ce rayon se remplit. Appelez-nous pour connaître le stock du moment.": "Deze afdeling wordt aangevuld. Bel ons voor de voorraad van het moment.",
  "Vous ne trouvez pas la bonne référence ?": "Vindt u de juiste referentie niet?",
  "<p>Décrivez-nous votre besoin : nous avons souvent l'équivalent en stock ou en commande fournisseur.</p>":
    "<p>Beschrijf ons wat u zoekt: vaak hebben we het equivalent in voorraad of in bestelling bij de fabrikant.</p>",
  "Livraison assurée en Belgique, offerte dès 1 500 € HTVA": "Verzekerde levering in België, gratis vanaf 1 500 € excl. btw",
  "Garantie 1 an pièces (neuf), 6 mois (occasion)": "1 jaar garantie op onderdelen (nieuw), 6 maanden (tweedehands)",
  "Conseil au +32 2 411 80 02, du lundi au samedi": "Advies op +32 2 411 80 02, van maandag tot zaterdag",
  "Ajouter au panier": "In winkelmandje",
  "Ajouté à votre panier.": "Toegevoegd aan uw winkelmandje.",
  "Voir le panier": "Bekijk winkelmandje",
  "Sur commande": "Op bestelling",
  Option: "Optie",
  Quantité: "Aantal",
  "Dans le même rayon": "In dezelfde afdeling",
  Recherche: "Zoeken",
  "Aucun produit ne correspond à votre recherche.": "Geen enkel product komt overeen met uw zoekopdracht.",

  // ---- cart, account, system ----
  "Votre panier": "Uw winkelmandje",
  "Votre panier est vide.": "Uw winkelmandje is leeg.",
  "Continuer mes achats": "Verder winkelen",
  "Passer au paiement sécurisé": "Veilig afrekenen",
  "TVA et livraison calculées au paiement.": "Btw en levering worden berekend bij het afrekenen.",
  "Sous-total": "Subtotaal",
  Supprimer: "Verwijderen",
  "Redirection…": "Doorverwijzen…",
  "Le paiement est momentanément indisponible. Réessayez ou contactez-nous.": "Betalen is tijdelijk niet mogelijk. Probeer opnieuw of neem contact op.",
  "Mon compte": "Mijn account",
  "Bonjour, {name}": "Dag {name}",
  "Vos commandes": "Uw bestellingen",
  "Vous n'avez pas encore passé de commande.": "U hebt nog geen bestelling geplaatst.",
  "Se connecter": "Aanmelden",
  "Créer un compte": "Account aanmaken",
  "Nom complet": "Volledige naam",
  "E-mail": "E-mail",
  "Mot de passe (8 caractères min.)": "Wachtwoord (min. 8 tekens)",
  "Créer mon compte": "Mijn account aanmaken",
  "Se déconnecter": "Afmelden",
  "Ouvrir Qubo": "Qubo openen",
  "E-mail ou mot de passe incorrect.": "E-mail of wachtwoord is onjuist.",
  "Un compte existe déjà pour cet e-mail. Connectez-vous.": "Er bestaat al een account met dit e-mailadres. Meld u aan.",
  "Utilisez au moins 8 caractères.": "Gebruik minstens 8 tekens.",
  "Une erreur est survenue. Réessayez.": "Er is iets misgelopen. Probeer opnieuw.",
  "En attente": "In afwachting",
  Confirmée: "Bevestigd",
  "En préparation": "In voorbereiding",
  Expédiée: "Verzonden",
  Livrée: "Geleverd",
  Terminée: "Afgerond",
  Annulée: "Geannuleerd",
  Remboursée: "Terugbetaald",
  "Nous revenons très vite": "We zijn zo terug",
  "<p>Notre boutique est en cours de maintenance. Pour toute urgence, appelez-nous ou écrivez-nous.</p>":
    "<p>Onze webshop is in onderhoud. Voor dringende vragen kunt u ons bellen of mailen.</p>",
  "Erreur 404": "Fout 404",
  "Cette page n'existe pas ou plus": "Deze pagina bestaat niet (meer)",
  "<p>Le catalogue a changé d'adresse. Reprenez depuis l'accueil ou cherchez directement un équipement.</p>":
    "<p>De catalogus is verhuisd. Begin opnieuw vanaf de homepage of zoek meteen een toestel.</p>",
  "Retour à l'accueil": "Terug naar de homepage",

  // ---- legal notice ----
  "<p>Ce site est édité par H.M. Catering Equipment s.a., exploitant la marque HM Froid.</p>":
    "<p>Deze site wordt uitgegeven door H.M. Catering Equipment nv, die het merk HM Froid uitbaat.</p>",
  Éditeur: "Uitgever",
  "<p>H.M. Catering Equipment s.a., société anonyme de droit belge. Siège : Avenue Raymond Vanderbruggen 18-20, 1070 Anderlecht (Bruxelles). Numéro d'entreprise et TVA : BE 0859.752.174.</p>":
    "<p>H.M. Catering Equipment nv, naamloze vennootschap naar Belgisch recht. Zetel: Raymond Vanderbruggenlaan 18-20, 1070 Anderlecht (Brussel). Ondernemingsnummer en btw: BE 0859.752.174.</p>",
  Contact: "Contact",
  "<p>Téléphone : +32 2 411 80 02. Fax : +32 2 411 80 03. E-mail : info@hmfroid.be.</p>": "<p>Telefoon: +32 2 411 80 02. Fax: +32 2 411 80 03. E-mail: info@hmfroid.be.</p>",
  Hébergement: "Hosting",
  "<p>Le site est hébergé sur un serveur privé situé dans l'Union européenne et administré pour le compte de l'éditeur.</p>":
    "<p>De site wordt gehost op een private server in de Europese Unie, beheerd voor rekening van de uitgever.</p>",
  "Propriété intellectuelle": "Intellectuele eigendom",
  "<p>Les textes, photos, logos et la structure de ce site sont la propriété de l'éditeur ou de ses fournisseurs. Toute reproduction sans accord écrit est interdite. Les marques citées appartiennent à leurs propriétaires respectifs.</p>":
    "<p>Teksten, foto's, logo's en de structuur van deze site zijn eigendom van de uitgever of zijn leveranciers. Elke reproductie zonder schriftelijke toestemming is verboden. De vermelde merken behoren toe aan hun respectieve eigenaars.</p>",
  Responsabilité: "Aansprakelijkheid",
  "<p>Les informations du catalogue (dimensions, puissances, prix) sont fournies par les fabricants et peuvent évoluer. Elles sont confirmées sur le devis avant toute commande.</p>":
    "<p>De catalogusgegevens (afmetingen, vermogens, prijzen) komen van de fabrikanten en kunnen wijzigen. Ze worden bevestigd op de offerte voor elke bestelling.</p>",

  // ---- about ----
  "<p>HM Froid est le nom commercial de H.M. Catering Equipment s.a., fournisseur de matériel horeca à Anderlecht depuis 2008. Nous vendons aux professionnels de bouche : restaurants, friteries, boucheries, boulangeries, snacks, traiteurs et collectivités.</p>":
    "<p>HM Froid is de handelsnaam van H.M. Catering Equipment nv, leverancier van horecamateriaal in Anderlecht sinds 2008. We verkopen aan voedingsprofessionals: restaurants, frituren, beenhouwerijen, bakkerijen, snackbars, traiteurs en grootkeukens.</p>",
  "Ce que nous faisons": "Wat we doen",
  "Vente de matériel neuf : froid commercial, cuisson, inox, préparation, lavage, ventilation": "Verkoop van nieuw materiaal: koeling, kooktoestellen, inox, voorbereiding, vaatwas, afzuiging",
  "Vente de matériel d'occasion révisé en atelier": "Verkoop van tweedehands materiaal, nagekeken in ons atelier",
  "Livraison assurée partout en Belgique et retrait au dépôt": "Verzekerde levering in heel België en afhaling in het magazijn",
  "Service après-vente, pièces et interventions": "Dienst na verkoop, onderdelen en interventies",
  "Rachat et reprise de votre matériel actuel": "Overname van uw huidige materiaal",
  "Ce que nous ne faisons pas": "Wat we niet doen",
  "<p>Nous ne faisons pas l'installation. Nous livrons et déposons le matériel à l'endroit convenu ; le raccordement eau, gaz ou électricité se fait avec votre installateur. Cela nous permet de rester concentrés sur le choix du matériel et son suivi.</p>":
    "<p>We installeren niet. We leveren en plaatsen het materiaal op de afgesproken plek; de aansluiting op water, gas of elektriciteit gebeurt met uw installateur. Zo blijven wij gefocust op de keuze van het materiaal en de opvolging ervan.</p>",
  "Le showroom": "De showroom",
  "<p>Avenue Raymond Vanderbruggen 18-20, 1070 Anderlecht (Bruxelles). Ouvert du lundi au vendredi de 9h à 18h et le samedi de 10h à 16h. Vous pouvez voir et toucher une grande partie du catalogue avant de décider.</p>":
    "<p>Raymond Vanderbruggenlaan 18-20, 1070 Anderlecht (Brussel). Open van maandag tot vrijdag van 9u tot 18u en op zaterdag van 10u tot 16u. U kunt een groot deel van de catalogus zien en aanraken voor u beslist.</p>",
  "Les marques": "De merken",
  "<p>Bertos, MBM, Robot Coupe, Tefcold, Hällde, Henkovac, Santos, Wooster, Potis, Gargano et d'autres fabricants européens. Nous choisissons des marques pour lesquelles nous pouvons fournir des pièces.</p>":
    "<p>Bertos, MBM, Robot Coupe, Tefcold, Hällde, Henkovac, Santos, Wooster, Potis, Gargano en andere Europese fabrikanten. We kiezen merken waarvoor we onderdelen kunnen leveren.</p>",
  "Envie de voir le matériel ?": "Wilt u het materiaal zien?",
  "<p>Le showroom est ouvert six jours sur sept. Appelez pour vérifier qu'une référence est exposée.</p>":
    "<p>De showroom is zes dagen op zeven open. Bel even om te checken of een referentie tentoongesteld staat.</p>",

  // ---- faq ----
  "<p>Les questions qui reviennent au comptoir et au téléphone. Si la vôtre n'y est pas, appelez-nous.</p>":
    "<p>De vragen die aan de toonbank en aan de telefoon terugkomen. Staat de uwe er niet bij? Bel ons.</p>",
  "Non. Nous vendons aux professionnels et aux collectivités. Les prix affichés sont hors TVA.": "Nee. We verkopen aan professionals en grootkeukens. De getoonde prijzen zijn exclusief btw.",
  "Non. Nous livrons et déposons le matériel à l'endroit convenu. Le raccordement eau, gaz ou électricité est à prévoir avec votre installateur.":
    "Nee. We leveren en plaatsen het materiaal op de afgesproken plek. De aansluiting op water, gas of elektriciteit regelt u met uw installateur.",
  "Combien coûte la livraison ?": "Wat kost de levering?",
  "De 25 € HTVA à Bruxelles à 150 € HTVA au Luxembourg selon la province, et offerte dès 1 500 € HTVA de commande. Le détail est sur la page Livraison et paiement.":
    "Van 25 € excl. btw in Brussel tot 150 € excl. btw in Luxemburg, volgens de provincie, en gratis vanaf 1 500 € excl. btw. Alle details staan op de pagina Levering en betaling.",
  "Quels sont les délais ?": "Wat zijn de termijnen?",
  "Le matériel en stock part sous quelques jours. Le matériel sur commande fournisseur prend en général deux à six semaines ; le délai est confirmé sur le devis.":
    "Materiaal uit voorraad vertrekt binnen enkele dagen. Materiaal op bestelling bij de fabrikant duurt doorgaans twee tot zes weken; de termijn wordt bevestigd op de offerte.",
  "Reprenez-vous mon ancien matériel ?": "Nemen jullie mijn oude materiaal over?",
  "Oui. Envoyez-nous des photos, la marque et le modèle via la page Rachat de matériel, nous vous faisons une proposition.":
    "Ja. Stuur ons foto's, merk en model via de pagina Overname van materiaal en we doen u een voorstel.",
  "Puis-je venir voir avant d'acheter ?": "Kan ik komen kijken voor ik koop?",
  "Comment payer ?": "Hoe betalen?",
  "Acompte de 40 % à la commande, solde avant livraison. Par virement, Bancontact, Visa, Mastercard ou Apple Pay.":
    "Voorschot van 40 % bij bestelling, saldo voor de levering. Via overschrijving, Bancontact, Visa, Mastercard of Apple Pay.",

  // ---- delivery and payment ----
  "<p>Nous livrons nous-mêmes en Belgique. Toutes nos livraisons sont assurées jusqu'à la remise au client. Le matériel est déposé à l'adresse convenue, au rez-de-chaussée ou à l'endroit accessible au transpalette.</p>":
    "<p>We leveren zelf in België. Al onze leveringen zijn verzekerd tot de overhandiging aan de klant. Het materiaal wordt afgezet op het afgesproken adres, op het gelijkvloers of waar de transpallet bij kan.</p>",
  "Tarifs de livraison en Belgique": "Leveringstarieven in België",
  "<p>Prix hors TVA, par livraison. La livraison est offerte dès 1 500 € HTVA de commande.</p>": "<p>Prijzen exclusief btw, per levering. Gratis levering vanaf 1 500 € excl. btw.</p>",
  Offerte: "Gratis",
  "dès 1 500 € HTVA": "vanaf 1 500 € excl. btw",
  Bruxelles: "Brussel",
  "Brabant wallon": "Waals-Brabant",
  "Brabant flamand": "Vlaams-Brabant",
  Hainaut: "Henegouwen",
  Namur: "Namen",
  Liège: "Luik",
  Luxembourg: "Luxemburg",
  Limbourg: "Limburg",
  Anvers: "Antwerpen",
  "Flandre occidentale": "West-Vlaanderen",
  "Flandre orientale": "Oost-Vlaanderen",
  "Hors Belgique": "Buiten België",
  "<p>Les livraisons à l'étranger se font par transporteur, aux frais du client et sur devis. Le matériel voyage alors aux risques de l'acheteur.</p>":
    "<p>Leveringen naar het buitenland gebeuren via een transporteur, op kosten van de klant en op offerte. Het materiaal reist dan op risico van de koper.</p>",
  "Retrait au dépôt": "Afhaling in het magazijn",
  "<p>Vous pouvez enlever votre commande à Anderlecht du lundi au vendredi de 9h à 17h, après confirmation de notre part. Le chargement se fait sous votre responsabilité.</p>":
    "<p>U kunt uw bestelling afhalen in Anderlecht van maandag tot vrijdag van 9u tot 17u, na onze bevestiging. Het laden gebeurt onder uw verantwoordelijkheid.</p>",
  "À la réception": "Bij ontvangst",
  "<p>Vérifiez le matériel en présence du livreur. Tout dommage ou manquant doit être noté sur le bon de livraison pour être pris en charge.</p>":
    "<p>Controleer het materiaal in aanwezigheid van de chauffeur. Schade of ontbrekende stukken moeten op de leveringsbon staan om in aanmerking te komen.</p>",
  Paiement: "Betaling",
  "<p>Un acompte de 40 % est demandé à la commande, le solde avant la livraison ou l'enlèvement. Les prix du site sont indiqués hors TVA.</p>":
    "<p>Bij bestelling vragen we een voorschot van 40 %, het saldo voor de levering of afhaling. De prijzen op de site zijn exclusief btw.</p>",
  "Virement bancaire (BNP Paribas Fortis, KBC ou ING, coordonnées sur le devis)": "Overschrijving (BNP Paribas Fortis, KBC of ING, gegevens op de offerte)",
  Bancontact: "Bancontact",
  "Visa et Mastercard": "Visa en Mastercard",
  "Apple Pay": "Apple Pay",

  // ---- warranty ----
  "Garantie et service après-vente": "Garantie en dienst na verkoop",
  "<p>Le matériel que nous vendons travaille dur. Voici ce que nous garantissons, pendant combien de temps, et comment se passe une intervention.</p>":
    "<p>Het materiaal dat we verkopen werkt hard. Dit is wat we waarborgen, hoelang, en hoe een interventie verloopt.</p>",
  "Durée de la garantie": "Duur van de garantie",
  "Matériel neuf : 1 an pièces pour un usage professionnel": "Nieuw materiaal: 1 jaar op onderdelen bij professioneel gebruik",
  "Matériel d'occasion : 6 mois pour un usage professionnel, après révision en atelier": "Tweedehands materiaal: 6 maanden bij professioneel gebruik, na nazicht in het atelier",
  "Revendeurs : 1 an sur les pièces uniquement": "Verdelers: 1 jaar, enkel op onderdelen",
  "Ce que la garantie ne couvre pas": "Wat de garantie niet dekt",
  "Les consommables : joints, filtres, lampes, vitres": "Verbruiksgoederen: dichtingen, filters, lampen, glas",
  "Les dégâts liés au calcaire ou à un défaut d'entretien": "Schade door kalk of gebrekkig onderhoud",
  "Les pannes dues à un mauvais raccordement ou à une utilisation hors usage prévu": "Defecten door een verkeerde aansluiting of oneigenlijk gebruik",
  "Le transport du matériel vers l'atelier": "Het transport van het materiaal naar het atelier",
  Interventions: "Interventies",
  "<p>Notre atelier et nos techniciens interviennent du lundi au vendredi de 8h30 à 17h. En dehors de ces heures, une intervention reste possible moyennant un forfait de 150 € HTVA, en plus des pièces.</p>":
    "<p>Ons atelier en onze techniekers werken van maandag tot vrijdag van 8u30 tot 17u. Buiten die uren blijft een interventie mogelijk tegen een forfait van 150 € excl. btw, bovenop de onderdelen.</p>",
  "Comment faire une demande": "Hoe een aanvraag indienen",
  "<p>Appelez le +32 2 411 80 02 ou écrivez à info@hmfroid.be avec le modèle, le numéro de série et une description de la panne. Une photo de la plaque signalétique accélère le diagnostic.</p>":
    "<p>Bel +32 2 411 80 02 of mail naar info@hmfroid.be met model, serienummer en een beschrijving van het defect. Een foto van het typeplaatje versnelt de diagnose.</p>",
  Entretien: "Onderhoud",
  "<p>Un nettoyage régulier des condenseurs et des filtres évite la majorité des pannes sur le froid. Nous vous expliquons les gestes utiles à la livraison.</p>":
    "<p>Regelmatig de condensors en filters reinigen voorkomt het merendeel van de koeldefecten. Bij de levering tonen we u de juiste handelingen.</p>",
  "Une panne ?": "Een defect?",
  "<p>Décrivez-la nous avec le modèle et le numéro de série : nous planifions l'intervention ou commandons la pièce.</p>":
    "<p>Beschrijf het ons met model en serienummer: we plannen de interventie of bestellen het onderdeel.</p>",

  // ---- privacy ----
  "<p>H.M. Catering Equipment s.a. est responsable du traitement des données collectées sur ce site. Nous collectons le minimum nécessaire pour répondre à vos demandes et traiter vos commandes.</p>":
    "<p>H.M. Catering Equipment nv is verantwoordelijk voor de verwerking van de gegevens die op deze site worden verzameld. We verzamelen enkel wat nodig is om uw vragen te beantwoorden en uw bestellingen te verwerken.</p>",
  "Données collectées": "Verzamelde gegevens",
  "Formulaires de contact, de devis et de rachat : société, nom, e-mail, téléphone, message": "Contact-, offerte- en overnameformulieren: bedrijf, naam, e-mail, telefoon, bericht",
  "Compte client : identifiants, coordonnées de facturation et de livraison, historique de commandes": "Klantenaccount: logingegevens, facturatie- en leveringsgegevens, bestelgeschiedenis",
  "Données techniques nécessaires au fonctionnement du site : adresse IP, journaux de connexion": "Technische gegevens nodig voor de werking van de site: IP-adres, verbindingslogs",
  Pourquoi: "Waarom",
  "Répondre à vos demandes et établir des devis": "Uw vragen beantwoorden en offertes opmaken",
  "Exécuter et suivre vos commandes, livraisons et garanties": "Uw bestellingen, leveringen en garanties uitvoeren en opvolgen",
  "Respecter nos obligations comptables et fiscales": "Onze boekhoudkundige en fiscale verplichtingen nakomen",
  "Combien de temps": "Hoelang",
  "<p>Les demandes de contact sont conservées deux ans après le dernier échange. Les données liées à une facture sont conservées dix ans, durée légale en Belgique. Un compte client inactif est supprimé après trois ans.</p>":
    "<p>Contactaanvragen bewaren we twee jaar na het laatste contact. Gegevens die bij een factuur horen bewaren we tien jaar, de wettelijke termijn in België. Een inactieve klantenaccount wordt na drie jaar verwijderd.</p>",
  "Avec qui": "Met wie",
  "<p>Vos données ne sont pas vendues. Elles sont partagées uniquement avec les prestataires nécessaires à l'exécution : transporteur, prestataire de paiement, hébergeur, comptable.</p>":
    "<p>Uw gegevens worden niet verkocht. Ze worden enkel gedeeld met de dienstverleners die nodig zijn voor de uitvoering: transporteur, betaalprovider, hostingpartij, boekhouder.</p>",
  Cookies: "Cookies",
  "<p>Le site utilise uniquement des cookies techniques : session, panier et connexion au compte. Aucun cookie publicitaire ni de suivi tiers n'est déposé.</p>":
    "<p>De site gebruikt enkel technische cookies: sessie, winkelmandje en aanmelding. Er worden geen advertentie- of trackingcookies van derden geplaatst.</p>",
  "Vos droits": "Uw rechten",
  "<p>Vous pouvez demander l'accès, la rectification, la suppression ou la portabilité de vos données en écrivant à info@hmfroid.be. Vous pouvez aussi introduire une réclamation auprès de l'Autorité de protection des données (APD).</p>":
    "<p>U kunt inzage, verbetering, verwijdering of overdracht van uw gegevens vragen via info@hmfroid.be. U kunt ook een klacht indienen bij de Gegevensbeschermingsautoriteit (GBA).</p>",

  // ---- terms ----
  "Conditions générales de vente": "Algemene verkoopvoorwaarden",
  "<p>Ces conditions s'appliquent à toute vente conclue par H.M. Catering Equipment s.a. avec un acheteur professionnel. Toute commande vaut acceptation de ces conditions.</p>":
    "<p>Deze voorwaarden gelden voor elke verkoop door H.M. Catering Equipment nv aan een professionele koper. Elke bestelling geldt als aanvaarding van deze voorwaarden.</p>",
  "Offres et prix": "Offertes en prijzen",
  "<p>Nos devis sont valables trente jours sauf mention contraire. Les prix s'entendent hors TVA, départ dépôt, livraison en sus selon le tarif en vigueur.</p>":
    "<p>Onze offertes zijn dertig dagen geldig, tenzij anders vermeld. De prijzen zijn exclusief btw, af magazijn, levering extra volgens het geldende tarief.</p>",
  "Commande et acompte": "Bestelling en voorschot",
  "<p>La commande est ferme à réception de l'acompte de 40 %. Le solde est payable avant la livraison ou l'enlèvement. Aucun matériel ne quitte le dépôt sans paiement complet.</p>":
    "<p>De bestelling is definitief bij ontvangst van het voorschot van 40 %. Het saldo is betaalbaar voor de levering of afhaling. Geen enkel toestel verlaat het magazijn zonder volledige betaling.</p>",
  Délais: "Termijnen",
  "<p>Les délais de livraison sont donnés à titre indicatif. Un retard ne peut donner lieu ni à l'annulation de la commande ni à une indemnité.</p>":
    "<p>Leveringstermijnen zijn indicatief. Een vertraging geeft geen recht op annulering van de bestelling of op een schadevergoeding.</p>",
  "Livraison et transfert des risques": "Levering en risico-overdracht",
  "<p>Les livraisons effectuées par nos soins en Belgique sont assurées jusqu'à la remise. Les expéditions par transporteur tiers voyagent aux risques de l'acheteur. Toute réserve doit être écrite sur le bon de livraison.</p>":
    "<p>Leveringen die wij zelf in België uitvoeren zijn verzekerd tot de overhandiging. Verzendingen via een externe transporteur reizen op risico van de koper. Elk voorbehoud moet op de leveringsbon worden genoteerd.</p>",
  "Réserve de propriété": "Eigendomsvoorbehoud",
  "<p>Le matériel reste la propriété du vendeur jusqu'au paiement intégral du prix.</p>": "<p>Het materiaal blijft eigendom van de verkoper tot de prijs volledig is betaald.</p>",
  Garantie: "Garantie",
  "<p>Les conditions de garantie sont décrites sur la page Garantie et service après-vente et font partie des présentes conditions.</p>":
    "<p>De garantievoorwaarden staan op de pagina Garantie en dienst na verkoop en maken deel uit van deze voorwaarden.</p>",
  Retours: "Retours",
  "<p>Le matériel vendu n'est ni repris ni échangé, sauf accord écrit préalable. Le matériel commandé spécialement pour l'acheteur ne peut pas être annulé.</p>":
    "<p>Verkocht materiaal wordt niet teruggenomen of geruild, behoudens voorafgaand schriftelijk akkoord. Materiaal dat speciaal voor de koper besteld is, kan niet worden geannuleerd.</p>",
  Litiges: "Geschillen",
  "<p>Le droit belge s'applique. En cas de litige, les tribunaux de l'arrondissement de Bruxelles sont seuls compétents.</p>":
    "<p>Het Belgische recht is van toepassing. Bij geschillen zijn enkel de rechtbanken van het arrondissement Brussel bevoegd.</p>",

  // ---- used equipment ----
  "Matériel horeca d'occasion, révisé et garanti": "Tweedehands horecamateriaal, nagekeken en gewaarborgd",
  "<p>Nos occasions viennent de reprises et de fins de bail. Chaque appareil passe par l'atelier : contrôle du groupe froid, des joints, des thermostats et des brûleurs, nettoyage et test en charge. Puis il est garanti six mois.</p>":
    "<p>Onze tweedehands toestellen komen van overnames en stopzettingen. Elk toestel passeert langs het atelier: controle van de koelgroep, dichtingen, thermostaten en branders, reiniging en test onder belasting. Daarna krijgt het zes maanden garantie.</p>",
  "Garantie 6 mois pour un usage professionnel": "6 maanden garantie bij professioneel gebruik",
  "Révisé et testé en atelier avant la vente": "Nagekeken en getest in het atelier voor de verkoop",
  "Visible au showroom d'Anderlecht": "Te zien in de showroom in Anderlecht",
  "Stock renouvelé chaque semaine": "Wekelijks nieuwe voorraad",
  "Appeler pour le stock du jour": "Bel voor de voorraad van vandaag",
  "Occasions en ligne": "Tweedehands online",
  "Une partie du stock seulement est publiée ici. Le reste se voit au showroom.": "Slechts een deel van de voorraad staat hier online. De rest ziet u in de showroom.",
  "Les occasions partent vite et ne sont pas toutes en ligne. Appelez-nous ou passez au showroom pour le stock du moment.":
    "Tweedehands gaat snel en staat niet allemaal online. Bel ons of kom langs in de showroom voor de voorraad van het moment.",
  "Déstockage et fins de série": "Stockverkoop en einde reeks",
  "Du neuf à prix réduit : expositions, fins de série, emballages abîmés.": "Nieuw aan verlaagde prijs: toonzaalmodellen, einde reeks, beschadigde verpakkingen.",
  "Voir le déstockage": "Bekijk de stockverkoop",
  "Pas de déstockage en ligne pour le moment.": "Momenteel geen stockverkoop online.",

  // ---- buy-back ----
  Reprise: "Overname",
  "Nous rachetons votre matériel horeca": "Wij kopen uw horecamateriaal over",
  "<p>Fermeture, rénovation, changement de carte ou remplacement : votre matériel a encore de la valeur. Nous rachetons le froid, la cuisson, l'inox et la préparation, à l'unité ou toute la cuisine.</p>":
    "<p>Sluiting, verbouwing, nieuwe kaart of vervanging: uw materiaal heeft nog waarde. We kopen koeling, kooktoestellen, inox en voorbereidingsmateriaal over, per stuk of de hele keuken.</p>",
  "Photos et liste": "Foto's en lijst",
  "Envoyez-nous les photos, marques, modèles et l'année approximative via le formulaire ci-dessous.": "Stuur ons foto's, merken, modellen en het bouwjaar bij benadering via het formulier hieronder.",
  Proposition: "Voorstel",
  "Nous revenons vers vous avec un prix. Pour une cuisine complète, nous passons sur place.": "We komen bij u terug met een prijs. Voor een volledige keuken komen we ter plaatse.",
  Enlèvement: "Ophaling",
  "Nous organisons l'enlèvement à la date convenue et le paiement à la reprise.": "We regelen de ophaling op de afgesproken datum en betalen bij de overname.",
  "Décrivez votre matériel": "Beschrijf uw materiaal",
  Société: "Bedrijf",
  Nom: "Naam",
  Téléphone: "Telefoon",
  "Adresse du matériel": "Adres van het materiaal",
  "Matériel à reprendre (marques, modèles, année, état)": "Over te nemen materiaal (merken, modellen, bouwjaar, staat)",
  "Demander une estimation": "Schatting aanvragen",
  "Merci. Nous revenons vers vous avec une proposition sous deux jours ouvrables.": "Bedankt. We komen binnen twee werkdagen bij u terug met een voorstel.",
  "Lun-Ven : 9h-18h\nSam : 10h-16h": "Ma-vr: 9u-18u\nZa: 10u-16u",

  // ---- brands ----
  "Les marques que nous distribuons": "De merken die we verdelen",
  "<p>Nous travaillons avec des fabricants pour lesquels nous pouvons fournir des pièces et un suivi. Cliquez sur une marque pour voir ses produits dans le catalogue.</p>":
    "<p>We werken met fabrikanten waarvoor we onderdelen en opvolging kunnen bieden. Klik op een merk om zijn producten in de catalogus te zien.</p>",
  "Cuisson professionnelle italienne : fourneaux, friteuses, plaques.": "Italiaanse professionele kooktoestellen: fornuizen, friteuses, bakplaten.",
  "Gammes de cuisson modulaires Minima, Domina, Magistra.": "Modulaire kookreeksen Minima, Domina, Magistra.",
  "Cutters, coupe-légumes et combinés pour la préparation.": "Cutters, groentesnijders en combitoestellen voor de voorbereiding.",
  "Armoires, vitrines et bahuts réfrigérés.": "Koelkasten, koelvitrines en diepvrieskisten.",
  "Coupe-légumes et combinés suédois.": "Zweedse groentesnijders en combitoestellen.",
  "Machines sous vide.": "Vacuümmachines.",
  "Presse-agrumes, blenders et moulins pour le bar.": "Citruspersen, blenders en molens voor de bar.",
  "Rayonnages pour chambres froides et réserves.": "Rekken voor koelcellen en voorraadruimtes.",
  "Friteuses à pression.": "Drukfriteuses.",
  "Cutters professionnels.": "Professionele cutters.",
  "Cuisson modulaire.": "Modulaire kooktoestellen.",
  "Grills à gyros et kebab.": "Gyros- en kebabgrills.",
  "Cellules de refroidissement rapide.": "Snelkoelers.",
  "Une marque que vous ne voyez pas ?": "Een merk dat u niet ziet?",
  "<p>Nous commandons aussi chez d'autres fabricants européens. Demandez-nous.</p>": "<p>We bestellen ook bij andere Europese fabrikanten. Vraag ernaar.</p>",

  // ---- trade pages ----
  "Les rayons utiles": "De nuttige afdelingen",
  "Quelques références": "Enkele referenties",
  "Voir tout le rayon": "Bekijk de hele afdeling",
  "Appelez-nous pour le stock du moment.": "Bel ons voor de voorraad van het moment.",
  "Un projet d'ouverture ou de rénovation ?": "Een opening of verbouwing op komst?",
  "<p>Venez avec votre plan au showroom : on dimensionne ensemble le froid, la cuisson et l'inox.</p>":
    "<p>Kom met uw plan naar de showroom: samen bepalen we de koeling, de kooktoestellen en het inox.</p>",
  "Armoires réfrigérées": "Koelkasten",
  // restaurant
  "Matériel pour restaurant et brasserie": "Materiaal voor restaurants en brasserieën",
  "<p>Fourneaux, fours, tables réfrigérées, lave-vaisselle et inox : tout l'équipement d'une cuisine de restaurant, à la pièce ou en projet complet.</p>":
    "<p>Fornuizen, ovens, koelwerkbanken, vaatwassers en inox: de volledige uitrusting van een restaurantkeuken, per stuk of als compleet project.</p>",
  "<p>Pour une ouverture, nous partons de votre carte et du nombre de couverts pour dimensionner la cuisson, le froid et le lavage. Pour un remplacement, nous cherchons un appareil aux mêmes dimensions pour éviter de refaire le plan.</p>":
    "<p>Bij een opening vertrekken we van uw kaart en het aantal couverts om de kooklijn, de koeling en de vaatwas te dimensioneren. Bij een vervanging zoeken we een toestel met dezelfde afmetingen, zodat het plan niet opnieuw hoeft.</p>",
  "<p>Fourneaux, plaques, friteuses, bains-marie en gammes modulaires 600, 700 et 900.</p>": "<p>Fornuizen, bakplaten, friteuses en bain-maries in modulaire reeksen 600, 700 en 900.</p>",
  "<p>Fours mixtes et à convection, de 4 à 20 niveaux.</p>": "<p>Combisteamers en heteluchtovens, van 4 tot 20 niveaus.</p>",
  "<p>Le froid au poste de travail, avec ou sans dosseret.</p>": "<p>Koeling op de werkpost, met of zonder opstaande rand.</p>",
  "<p>Positives et négatives, une à quatre portes.</p>": "<p>Koel en diepvries, één tot vier deuren.</p>",
  "<p>Lave-verres, lave-vaisselle à capot et plonges.</p>": "<p>Glazenspoelmachines, doorschuifvaatwassers en spoeltafels.</p>",
  "<p>Tables, étagères, armoires murales et chariots.</p>": "<p>Werktafels, rekken, wandkasten en wagens.</p>",
  // bakery
  "Matériel pour boulangerie et pâtisserie": "Materiaal voor bakkerijen en patisserie",
  "<p>Vitrines réfrigérées, batteurs, armoires et cellules de refroidissement : le froid et la préparation d'un laboratoire de pâtisserie.</p>":
    "<p>Koelvitrines, kloppers, koelkasten en snelkoelers: de koeling en voorbereiding van een patisserieatelier.</p>",
  "<p>La pâtisserie demande un froid précis et sec, et des cellules capables de descendre vite en température. Nous proposons des armoires pâtissières au format 600 x 400, des cellules de refroidissement rapide et des vitrines qui mettent les produits en valeur sans les dessécher.</p>":
    "<p>Patisserie vraagt precieze, droge koeling en snelkoelers die snel in temperatuur zakken. We bieden bakkerijkoelkasten op formaat 600 x 400, snelkoelers en vitrines die de producten tonen zonder ze uit te drogen.</p>",
  "<p>Vitrines de présentation pour pâtisseries et sandwiches.</p>": "<p>Toonbankvitrines voor gebak en broodjes.</p>",
  "<p>Refroidissement et surgélation rapides.</p>": "<p>Snel koelen en invriezen.</p>",
  "<p>Positives, négatives, formats pâtissiers.</p>": "<p>Koel, diepvries, bakkerijformaten.</p>",
  "<p>De 10 à 60 litres pour les pâtes et les crèmes.</p>": "<p>Van 10 tot 60 liter voor deeg en crèmes.</p>",
  "Vitrines à glace": "IJsvitrines",
  "<p>Pour la glace artisanale en saison.</p>": "<p>Voor ambachtelijk ijs in het seizoen.</p>",
  "<p>Tables de travail et étagères pour le laboratoire.</p>": "<p>Werktafels en rekken voor het atelier.</p>",
  // frituur
  "Matériel pour friterie": "Materiaal voor frituren",
  "<p>Friteuses haut rendement, bacs réfrigérés pour les frites fraîches, tables de travail et vitrines à snacks : l'équipement d'une friterie qui tient le coup de feu.</p>":
    "<p>Hoogrendementsfriteuses, koelbakken voor verse frieten, werktafels en snackvitrines: de uitrusting van een frituur die het spitsuur aankan.</p>",
  "<p>Une friterie use son matériel plus vite qu'un restaurant. Nous privilégions des friteuses à cuve profonde et à relance rapide, de l'inox facile à nettoyer et du froid dimensionné pour des portes qui s'ouvrent souvent.</p>":
    "<p>Een frituur verslijt haar materiaal sneller dan een restaurant. We kiezen voor friteuses met diepe kuip en snelle opwarming, makkelijk te reinigen inox en koeling die gebouwd is op deuren die vaak opengaan.</p>",
  "<p>Gaz ou électrique, une à trois cuves, filtration intégrée sur certains modèles.</p>": "<p>Gas of elektrisch, één tot drie kuipen, ingebouwde filtering op sommige modellen.</p>",
  "Friteuses haut rendement": "Hoogrendementsfriteuses",
  "<p>Pour les files d'attente : relance rapide et grande capacité.</p>": "<p>Voor de wachtrij: snelle opwarming en grote capaciteit.</p>",
  "<p>Frites fraîches, sauces et snacks au froid, plan de travail en inox.</p>": "<p>Verse frieten, sauzen en snacks gekoeld, werkblad in inox.</p>",
  "<p>Boissons et snacks visibles depuis la file.</p>": "<p>Dranken en snacks zichtbaar vanuit de rij.</p>",
  "<p>Pour les hamburgers et les mitraillettes.</p>": "<p>Voor hamburgers en mitraillettes.</p>",
  "<p>Tables, plonges et étagères pour le poste de travail.</p>": "<p>Werktafels, spoeltafels en rekken voor de werkpost.</p>",
  // butcher
  "Matériel pour boucherie et traiteur": "Materiaal voor beenhouwerijen en traiteurs",
  "<p>Vitrines réfrigérées, chambres froides, trancheuses, hachoirs et scies à os : le matériel d'une boucherie, du laboratoire au comptoir.</p>":
    "<p>Koeltogen, koelcellen, snijmachines, vleesmolens en beenderzagen: het materiaal van een beenhouwerij, van atelier tot toonbank.</p>",
  "<p>Le froid de boucherie doit tenir une température stable toute la journée, vitrine ouverte. Nous proposons des vitrines ventilées ou statiques selon les produits, des chambres froides positives et négatives et de la préparation robuste.</p>":
    "<p>Koeling voor de beenhouwerij moet de hele dag een stabiele temperatuur houden, met open toog. We bieden geventileerde of statische togen volgens de producten, koel- en diepvriescellen en robuust voorbereidingsmateriaal.</p>",
  "<p>Vitrines de présentation pour la viande et le traiteur.</p>": "<p>Toonbankvitrines voor vlees en traiteur.</p>",
  "<p>Positives et négatives, monoblocs fournis.</p>": "<p>Koel en diepvries, monoblok inbegrepen.</p>",
  "<p>À gravité ou verticales, lames de 250 à 350 mm.</p>": "<p>Schuin of verticaal, messen van 250 tot 350 mm.</p>",
  "<p>Pour la viande hachée du jour.</p>": "<p>Voor het gehakt van de dag.</p>",
  "<p>Pour la découpe au laboratoire.</p>": "<p>Voor het versnijden in het atelier.</p>",
  "<p>Conservation et vente en portions.</p>": "<p>Bewaren en verkopen in porties.</p>",

  // ---- sitemap page ----
  "Toutes les pages du site, pour s'y retrouver.": "Alle pagina's van de site, om snel uw weg te vinden.",
  Pages: "Pagina's",
  Catégories: "Categorieën",

  // ---- contact ----
  "Contact et showroom": "Contact en showroom",
  "<p>Pour un devis, une question sur une référence ou une reprise de matériel. Nous répondons en français et en néerlandais, en semaine comme le samedi matin.</p>":
    "<p>Voor een offerte, een vraag over een referentie of een overname van materiaal. We antwoorden in het Nederlands en het Frans, in de week en op zaterdagvoormiddag.</p>",
  "Nous écrire": "Schrijf ons",
  Message: "Bericht",
  Envoyer: "Verzenden",
  "Merci, nous revenons vers vous dans la journée ouvrable.": "Bedankt, we komen binnen de werkdag bij u terug.",
  Itinéraire: "Routebeschrijving",
  "Nous rendre visite": "Kom langs",

  // ---- document root titles (feed the page <title>) ----
  "HM Froid, matériel horeca neuf et d'occasion à Bruxelles": "HM Froid, nieuw en tweedehands horecamateriaal in Brussel",
  Catalogue: "Catalogus",
  Collection: "Afdeling",
  Produit: "Product",
  "Page introuvable": "Pagina niet gevonden",
  "Matériel horeca d'occasion": "Tweedehands horecamateriaal",
  "Rachat de matériel horeca": "Overname van horecamateriaal",
};
