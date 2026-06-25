import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

const COMMON_WORDS = new Set([
  "the","be","to","of","and","a","in","that","have","i","it","for","not","on","with","he",
  "as","you","do","at","this","but","his","by","from","they","we","say","her","she","or",
  "an","will","my","one","all","would","there","their","what","so","up","out","if","about",
  "who","get","which","go","me","when","make","can","like","time","no","just","him","know",
  "take","people","into","year","your","good","some","could","them","see","other","than",
  "then","now","look","only","come","its","over","think","also","back","after","use","two",
  "how","our","work","first","well","way","even","new","want","because","any","these","give",
  "day","most","us","great","between","need","large","often","very","place","small","under",
  "long","right","here","why","live","where","without","before","help","through","much",
  "many","too","own","old","same","tell","does","set","three","want","air","well","also",
  "play","small","end","put","home","read","hand","port","large","spell","add","even","land",
  "here","must","big","high","such","follow","act","why","ask","men","change","went","light",
  "kind","off","need","house","picture","try","us","again","animal","point","mother","world",
  "near","build","self","earth","father","head","stand","own","page","should","country","found",
  "answer","school","grow","study","still","learn","plant","food","sun","four","between","state",
  "keep","eye","never","last","let","thought","city","tree","cross","farm","hard","start","might",
  "story","saw","far","sea","draw","left","late","run","while","press","close","night","real",
  "life","few","north","open","seem","together","next","white","children","begin","got","walk",
  "example","ease","paper","group","always","music","those","both","mark","book","letter","until",
  "mile","river","car","feet","care","second","enough","plain","girl","usual","young","ready",
  "above","ever","red","list","though","feel","talk","bird","soon","body","dog","family","direct",
  "pose","leave","song","measure","door","product","black","short","number","class","wind","question",
  "happen","complete","ship","area","half","rock","order","fire","south","problem","piece","told",
  "knew","pass","since","top","whole","king","space","heard","best","hour","better","true","during",
  "hundred","remember","step","early","hold","west","ground","interest","reach","fast","verb","sing",
  "listen","six","table","travel","less","morning","ten","simple","vowel","toward","war","lay","against",
  "pattern","slow","center","love","person","money","serve","appear","road","map","science","friend",
  "began","idea","count","here","water","upon","side","system","plane","each","string","dark","surface",
  "note","past","sent","choose","feel","drive","several","become","suggest","field","rest","careful",
  "describe","sometimes","difficult","possible","clear","amaze","represent","soft","whether","explain",
  "develop","beauty","contain","measure","determine","silence","happen","nor","gold","among","describe",
  "solve","supply","usual","prepare","mine","level","produce","certain","effect","industry","general",
  "present","probable","colour","special","prove","necessary","direct","several","agree","particular",
  "enough","current","reason","length","machine","industry","section","process","condition","method",
  "include","control","value","design","material","purpose","position","standard","subject","surface",
  "himself","history","sometimes","necessary","difficult","government","organization","experience",
  "development","environment","information","opportunity","performance","relationship","structure",
  "community","knowledge","management","production","responsibility","understanding","consequence",
  "communication","representation","establishment","implementation","recommendation","infrastructure",
]);

const COMMON_PT_WORDS = new Set([
  "a","ao","aos","aquela","aquelas","aquele","aqueles","aquilo","as","até","com","como","da",
  "das","de","dela","delas","dele","deles","depois","do","dos","e","ela","elas","ele","eles",
  "em","enquanto","entre","era","eram","essa","essas","esse","esses","esta","estamos","estar",
  "estas","estava","estavam","este","esteja","estejam","estes","estou","eu","foi","fomos",
  "for","foram","fosse","fossem","há","isso","isto","já","lhe","lhes","lo","mas","me","mesmo",
  "meu","meus","minha","minhas","muito","na","nas","nem","no","nos","nossa","nossas","nosso",
  "nossos","num","numa","o","os","ou","para","pela","pelas","pelo","pelos","por","qual","quando",
  "que","quem","se","seja","sejam","sem","sendo","será","sobre","sua","suas","talvez","te","tem",
  "temos","tenha","tenham","ter","teu","teus","ti","tido","tinha","tinham","tive","tivemos","tiver",
  "tivesse","tivessem","to","tua","tuas","um","uma","umas","você","vocês","vos","vossas","vossa",
  "vossos","à","às","é","está","são","só","têm","tém","ser","entre","contra","durante","sem",
  "sob","trás","através","conforme","mediante","segundo","exceto","salvo","menos","inclusive",
  "mais","menos","tanto","quanto","como","igualmente","assim","bem","mal","sim","também",
  "não","sim","talvez","sempre","nunca","jamais","agora","já","cedo","tarde","antes","depois",
  "aqui","ali","lá","acolá","dentro","fora","perto","longe","acima","abaixo","defronte",
  "adiante","atrás","além","aquém","onde","aonde","donde","como","muito","pouco","bastante",
  "demais","quanto","quão","tão","tanto","assaz","cerca","aproximadamente","exatamente",
  "justamente","provavelmente","possivelmente","certamente","realmente","naturalmente",
  "infelizmente","felizmente","infelizmente","infelizmente","infelizmente",
]);

const ALL_WORDS = new Set([...COMMON_WORDS, ...COMMON_PT_WORDS]);

export const checkSpellingTool: ToolDefinition = {
  name: "check_spelling",
  description:
    "Verificar ortografia básica no texto visível da página. Detecta palavras potencialmente incorretas usando um dicionário embutido de ~1000 palavras em inglês e português. AVISO: Verificação simplificada — palavras técnicas, nomes próprios e neologismos podem gerar falsos positivos.",
  args: {
    language: z.string().optional().describe("Idioma: 'en' (inglês, padrão), 'pt' (português), 'both'"),
  },
  async execute(args: { language?: string }) {
    const page = await getPage();
    const url = page.url();
    const lang = args.language || "both";

    const text = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, 4, null);
      const texts: string[] = [];
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const t = node.textContent?.trim();
        if (t && t.length > 1) texts.push(t);
      }
      return texts.join(" ");
    });

    const words = text
      .toLowerCase()
      .replace(/[^a-zà-ÿáéíóúâêîôûãõçñ\s-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && w.length < 30 && !/^\d+$/.test(w));

    const seen = new Set<string>();
    const potentialErrors: Array<{ word: string; context: string; suggestion?: string }> = [];

    for (const word of words) {
      if (seen.has(word)) continue;
      seen.add(word);
      if (ALL_WORDS.has(word)) continue;
      const wordClean = word.replace(/[áàâãéèêíïóôõúüç]/g, (c) => {
        const map: Record<string, string> = {á:"a",à:"a",â:"a",ã:"a",é:"e",è:"e",ê:"e",í:"i",ï:"i",ó:"o",ô:"o",õ:"o",ú:"u",ü:"u",ç:"c"};
        return map[c] || c;
      });
      if (ALL_WORDS.has(wordClean)) continue;
      potentialErrors.push({ word, context: text.slice(Math.max(0, text.indexOf(word) - 30), text.indexOf(word) + word.length + 30).trim().slice(0, 80) });
    }

    console.error(`🔤 Spelling: ${potentialErrors.length} potential issues out of ${seen.size} unique words`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalUniqueWords: seen.size,
        potentialErrors: potentialErrors.length,
        suggestions: potentialErrors.slice(0, 50),
        note: "Verificação simplificada. Palavras técnicas, nomes próprios e neologismos podem aparecer como falsos positivos.",
      }, null, 2) }],
    };
  },
};
