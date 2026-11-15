/* 配置：10 章 / 50 关 / 键位 / 段位 / 文案 / 图标 */
/* ===== 键盘探险 · 打字闯关 =====
   每章 5 关：前 4 关教新内容，第 5 关是本行四课的总结挑战。
   总结关的键位和词库由前 4 关自动合并，不新增任何键位或单词，
   只把关卡参数（速度、下落密度、目标分、时长）加严。
   练习一次 → 得 1 张练习券 → 玩一局 → 券用完，再回练习。
   所有记录写在 localStorage，键名 shutu_typing_quest_v1。 */

var STORE_KEY = 'shutu_typing_quest_v1';

/* ---------- 章节与课时 ----------
   课时字段：
   name 课名 / keys 本课新键 / words 本课词库 / caps 是否要求大写
   p[0] 练习题量（字母课为字符数，单词课为词数） p[1] 练习过关正确率
   g = [target 目标分, time 秒数, speed 初始下落速度, spawn 出现间隔, ramp 加速]
*/
var CHAPTERS = [
    {
        no: '01', name: '基准键', sub: '八根手指先找到自己的家',
        boss: '基准键总结战',
        lessons: [
            {
                name: 'F 与 J', keys: ['f', 'j'], p: [10, 80], g: [40, 40, 36, 2.8, 0.25],
                desc: '两只食指摸到 F 和 J 上的小凸点，其他手指自然排开。每次手乱了，都从这里找回家。',
                hint: '食指轻轻落下，别用整只手去够键。'
            },
            {
                name: 'D 与 K', keys: ['d', 'k'], p: [12, 80], g: [50, 42, 40, 2.6, 0.35],
                desc: '中指从 E、U 的位置收回 D 和 K。落键时其他手指要留在原位，别跟着一起抬起来。',
                hint: '中指落下去，手腕别往下压。'
            },
            {
                name: 'S 与 L', keys: ['s', 'l'], p: [14, 82], g: [60, 44, 44, 2.4, 0.45],
                desc: '无名指守 S 和 L。这两根手指最容易偷懒，按完记得往回收，不要停在半空。',
                hint: '无名指按完就回收，别悬着等下一个键。'
            },
            {
                name: 'A 与 G、H', keys: ['a', 'g', 'h'], p: [16, 82], g: [70, 46, 48, 2.2, 0.55],
                desc: '左小指守 A，两根食指分别向外够 G 和 H。到这一课，主键区九键就齐了。',
                hint: 'G 用左食指、H 用右食指，别用中指代劳。'
            }
        ]
    },
    {
        no: '02', name: '上排', sub: '手指往上伸一格，敲完就回家',
        boss: '上排总结战',
        lessons: [
            {
                name: 'E 与 I', keys: ['e', 'i'], p: [14, 82], g: [80, 46, 52, 2.1, 0.7],
                desc: '中指从 D、K 往上伸一格就是 E 和 I。敲完立刻回主键区，手型不要翻上去。',
                hint: '伸上去的时候，其他手指别跟着跑。'
            },
            {
                name: 'R 与 U', keys: ['r', 'u'], p: [16, 83], g: [90, 48, 56, 2.0, 0.8],
                desc: '食指从 F、J 斜上一步到 R、U。这两键用得最多，落键要稳。',
                hint: '食指斜着上，手掌保持原位。'
            },
            {
                name: 'T 与 Y', keys: ['t', 'y'], p: [16, 83], g: [100, 50, 60, 1.95, 0.9],
                desc: '食指再往上够一格到 T、Y，这是上排最远的一对键，够完马上收回来。',
                hint: '够 T、Y 的时候掌根不要离开桌面。'
            },
            {
                name: 'W、O、Q、P', keys: ['w', 'o', 'q', 'p'], p: [20, 84], g: [110, 52, 64, 1.9, 1.0],
                desc: '无名指管 W、O，小指管 Q、P。小指最没力气，慢一点按准，比按快重要。',
                hint: '小指按 Q、P 时，另外三根手指保持不动。'
            }
        ]
    },
    {
        no: '03', name: '下排', sub: '往下缩一格，手掌别跟着塌',
        boss: '下排总结战',
        lessons: [
            {
                name: 'V 与 N', keys: ['v', 'n'], p: [16, 83], g: [120, 52, 68, 1.9, 1.0],
                desc: '食指往下缩一格是 V、N，这是下排的起点。往下按的时候手掌最容易转，压住手腕。',
                hint: '用指尖往下，别整只手往下砸。'
            },
            {
                name: 'B 与 M', keys: ['b', 'm'], p: [18, 84], g: [130, 54, 72, 1.85, 1.1],
                desc: '食指再往外一格就是 B、M。B 在中间偏左，用左手食指；M 在最右边，用右手食指。',
                hint: 'B、M 都归食指，不要用小指代替。'
            },
            {
                name: 'C 与 X', keys: ['c', 'x'], p: [18, 84], g: [140, 56, 76, 1.8, 1.2],
                desc: '中指管 C，无名指管 X。下排中间的键最容易被按歪，看清手指再落。',
                hint: 'C、X 按完，指尖留在下排，别往上飘。'
            },
            {
                name: 'Z 与下排连打', keys: ['z', 'x', 'c', 'v', 'b', 'n', 'm'], p: [22, 84], g: [150, 58, 80, 1.75, 1.3],
                desc: '小指补上最后的 Z，这一课要把 Z X C V B N M 七个键连起来打，中间不要停手。',
                hint: 'Z 用左小指，慢一点也要按准。'
            }
        ]
    },
    {
        no: '04', name: '大写', sub: '按住 Shift，把字母变成大写',
        boss: '大写总结战',
        lessons: [
            {
                name: '大写 J 与 K', keys: ['J', 'K'], caps: true, p: [16, 84], g: [130, 56, 70, 1.85, 1.1],
                desc: '按住左边的 Shift，再按 J 和 K。Shift 用另一只手的小指压住，敲完立刻松开。',
                hint: '左小指压 Shift，右手中指、食指落键。'
            },
            {
                name: '大写 U 与 I', keys: ['U', 'I'], caps: true, p: [16, 84], g: [140, 58, 74, 1.8, 1.2],
                desc: '还是左 Shift，右手的食指和中指往上够。两个动作要连成一个，不要先松手再按字母。',
                hint: 'Shift 一直压住，字母一个个来。'
            },
            {
                name: '大写 A 与 S', keys: ['A', 'S'], caps: true, p: [18, 84], g: [150, 60, 78, 1.75, 1.3],
                desc: '这次换右手小指压 Shift，左手按 A 和 S。左右手调过来配合，手型别歪。',
                hint: '右 Shift 加左手键，两只手各管一件事。'
            },
            {
                name: '上排大写冲刺', keys: ['E', 'R', 'T', 'Y', 'W', 'O', 'Q', 'P'], caps: true, p: [20, 85], g: [160, 62, 82, 1.7, 1.4],
                desc: '把上排八个字母全用大写打一遍。Shift 压住不放，字母连续敲，节奏比单个用力更重要。',
                hint: '先按 Shift 再落字母，两个动作合成一个。'
            }
        ]
    },
    {
        no: '05', name: '数字排', sub: '最上面那一排，手指要够得着',
        boss: '数字总结战',
        lessons: [
            {
                name: '1 与 2', keys: ['1', 'q', '2', 'w'], p: [16, 84], g: [160, 58, 84, 1.8, 1.3],
                desc: '左小指够 1，左无名指够 2，够完马上回到下面的 Q、W。数字键和字母键交替着练。',
                hint: '够数字的时候，其他手指留在主键区。'
            },
            {
                name: '3 与 4', keys: ['3', 'e', '4', 'r'], p: [16, 84], g: [170, 60, 88, 1.75, 1.4],
                desc: '左中指上 3，左食指上 4。够完回到 E、R，手指不要停在数字排。',
                hint: '上去一格就够，胳膊不用跟着抬。'
            },
            {
                name: '5 与 6', keys: ['5', 't', '6', 'y'], p: [18, 85], g: [180, 62, 92, 1.7, 1.5],
                desc: '5 是左食指、6 是右食指，这两键在正中间，最容易按到隔壁。看清是左还是右。',
                hint: '5 用左手食指、6 用右手食指，别抢。'
            },
            {
                name: '7、8、9、0', keys: ['7', 'u', '8', 'i', '9', 'o', '0', 'p'], p: [20, 85], g: [190, 64, 96, 1.65, 1.6],
                desc: '右手往外上一格：7 食指、8 中指、9 无名指、0 小指。小指够 0 的时候，手腕可以稍微抬一点。',
                hint: '0 是小指，够不到就抬手，别让整只手翻过来。'
            }
        ]
    },
    {
        no: '06', name: '三字母词', sub: '字母连成词，才是真正的打字',
        boss: '短词总结战',
        lessons: [
            {
                name: '-at 家族', p: [8, 86], g: [150, 60, 36, 2.7, 0.3],
                words: ['cat', 'hat', 'bat', 'rat', 'mat', 'sat', 'fat', 'pat', 'cap', 'map', 'tap', 'nap'],
                desc: 'at、ap 结尾的小词，读起来像一个节拍。先看整词，再一个字母一个字母敲。',
                hint: '先看整词，再动手，不要看键盘。'
            },
            {
                name: '-en / -et 家族', p: [8, 86], g: [165, 62, 38, 2.6, 0.35],
                words: ['bed', 'red', 'ten', 'pen', 'hen', 'men', 'net', 'pet', 'let', 'get', 'set', 'wet'],
                desc: '这两个词族只换了头尾一两个字母，看清第一个字母再落手。',
                hint: '词头不一样，别按习惯乱猜。'
            },
            {
                name: '-ig / -it 家族', p: [9, 87], g: [180, 64, 40, 2.5, 0.4],
                words: ['big', 'dig', 'pig', 'fig', 'sit', 'bit', 'hit', 'fit', 'lip', 'tip', 'win', 'pin'],
                desc: 'ig 和 it 两个词族混着来，字母位置差一点就按错，眼睛要盯住整词。',
                hint: '一个词敲完再找下一个，别中途换目标。'
            },
            {
                name: '-og / -op 与短 u', p: [9, 87], g: [195, 66, 42, 2.4, 0.45],
                words: ['dog', 'log', 'fog', 'hot', 'pot', 'dot', 'box', 'fox', 'top', 'cup', 'bug', 'sun'],
                desc: 'o 和 u 的短词一起练。u 的键在下排，手指要往下缩，别按成 o。',
                hint: 'u 在下排中间偏右，用右手食指。'
            }
        ]
    },
    {
        no: '07', name: '四字母词', sub: '词变长了，先看整词再动手',
        boss: '四字母总结战',
        lessons: [
            {
                name: '身边的物', p: [8, 87], g: [210, 68, 42, 2.6, 0.4],
                words: ['hand', 'door', 'desk', 'room', 'book', 'tree', 'bird', 'fish', 'star', 'moon', 'milk', 'cake'],
                desc: '眼睛能看见的东西最好记。四个字母里往往有两个是同一个手指，节奏要匀。',
                hint: '一个词敲完再找下一个，眼睛先扫整词。'
            },
            {
                name: '动作词', p: [8, 87], g: [230, 70, 44, 2.5, 0.45],
                words: ['read', 'walk', 'jump', 'play', 'swim', 'sing', 'draw', 'cook', 'wash', 'help', 'talk', 'call'],
                desc: '动词大多是常用键位，j、k、l 出现得多，右手要跟上。',
                hint: '右边两个字母连着来的时候，别用手腕甩。'
            },
            {
                name: '形容词', p: [9, 88], g: [250, 72, 46, 2.4, 0.5],
                words: ['good', 'fast', 'slow', 'tall', 'dark', 'warm', 'cold', 'soft', 'nice', 'kind', 'busy', 'easy'],
                desc: '这一组里有不少双写字母，比如 good、tall。同一个键连按两下，手指别弹太高。',
                hint: '连按同一个键只要抬一点点，不要整根手指抬起来。'
            },
            {
                name: '易混四字母', p: [9, 88], g: [270, 74, 48, 2.3, 0.55],
                words: ['then', 'than', 'them', 'they', 'this', 'that', 'with', 'from', 'form', 'were', 'what', 'when'],
                desc: '这组词长得太像：then 和 than，from 和 form。看清字母顺序，别凭手感猜。',
                hint: '长得像的词，一定要逐个字母确认。'
            }
        ]
    },
    {
        no: '08', name: '五字母词', sub: '五个字母一口气打完',
        boss: '五字母总结战',
        lessons: [
            {
                name: '家与日常', p: [8, 88], g: [290, 74, 44, 2.6, 0.45],
                words: ['house', 'water', 'light', 'night', 'table', 'chair', 'phone', 'clock', 'bread', 'plant', 'paper', 'dress'],
                desc: '五字母词一般横跨两手，注意左右手的交接，别在一个词中间卡住。',
                hint: '左右手交接的地方最容易慢，提前想好下一个字母在哪只手。'
            },
            {
                name: '自然与地方', p: [8, 88], g: [310, 76, 46, 2.5, 0.5],
                words: ['grass', 'cloud', 'river', 'beach', 'story', 'stone', 'field', 'ocean', 'north', 'south', 'coast', 'shore'],
                desc: '这组词里 s 和 c 出现得很频繁。左手的无名指和中指要撑住。',
                hint: 's 和 c 都在左手，注意别用错手指。'
            },
            {
                name: '动作与学习', p: [9, 88], g: [330, 78, 48, 2.4, 0.55],
                words: ['start', 'learn', 'write', 'think', 'speak', 'watch', 'carry', 'build', 'break', 'teach', 'study', 'press'],
                desc: '这组词有 st、th、ea 这样的固定组合弹出来，熟了就能整块打。',
                hint: '常见字母组合当成一个小节，一起敲出去。'
            },
            {
                name: '形容与程度', p: [9, 89], g: [350, 80, 50, 2.3, 0.6],
                words: ['happy', 'sweet', 'small', 'large', 'fresh', 'clean', 'brave', 'quiet', 'angry', 'heavy', 'early', 'young'],
                desc: 'happy 有两个 p，small 有两个 l，quiet 的 q 用左小指。这组专门练重复和弱指。',
                hint: '小指按 q 只要指尖动，手腕别跟着扭。'
            }
        ]
    },
    {
        no: '09', name: '六字母词', sub: '长词靠节奏，不是靠快',
        boss: '六字母总结战',
        lessons: [
            {
                name: '家人与朋友', p: [8, 89], g: [370, 78, 46, 2.6, 0.5],
                words: ['family', 'friend', 'mother', 'father', 'sister', 'people', 'health', 'school', 'garden', 'summer', 'winter', 'spring'],
                desc: '六个字母的词，一口气打完会明显更快。先在脑子里读一遍，再动手。',
                hint: '读一遍再打，嘴里念着节奏更稳。'
            },
            {
                name: '场所与物件', p: [8, 89], g: [390, 80, 48, 2.5, 0.55],
                words: ['market', 'window', 'street', 'letter', 'number', 'minute', 'second', 'pencil', 'coffee', 'banana', 'orange', 'flower'],
                desc: '这组词里 w、m、k 都在右手或两侧，容易在中间断手。找准换手的时机。',
                hint: '换手的位置提前想好，别打到一半停住。'
            },
            {
                name: '动作与习惯', p: [9, 89], g: [410, 82, 50, 2.4, 0.6],
                words: ['travel', 'follow', 'listen', 'finish', 'answer', 'change', 'choose', 'create', 'decide', 'expect', 'forget', 'happen'],
                desc: '这些词里 ll、ss、pp 这样的双辅音不少，连按两次不要弹手指。',
                hint: '双写字母只要轻轻回一下，不用抬整根手指。'
            },
            {
                name: '程度与连接', p: [9, 90], g: [430, 84, 52, 2.3, 0.65],
                words: ['always', 'almost', 'around', 'before', 'better', 'little', 'strong', 'enough', 'across', 'during', 'either', 'really'],
                desc: '这一组词左右手交替最频繁，节奏感最重要。稳住速度，不要一快就翻车。',
                hint: '保持同一个速度，比忽快忽慢更省力。'
            }
        ]
    },
    {
        no: '10', name: '长词冲刺', sub: '最后五行，把整只手用起来',
        boss: '终极总结战',
        lessons: [
            {
                name: '七个字母', p: [8, 90], g: [450, 82, 46, 2.7, 0.5],
                words: ['morning', 'evening', 'holiday', 'library', 'picture', 'kitchen', 'village', 'teacher', 'student', 'weather', 'brother', 'outside'],
                desc: '七个字母开始，眼睛要一次扫完整个词。看清结尾，别打到一半才发现看错了。',
                hint: '眼睛比手快一步，先看完整词再落手。'
            },
            {
                name: '八个字母', p: [8, 90], g: [480, 84, 48, 2.6, 0.55],
                words: ['birthday', 'computer', 'keyboard', 'remember', 'together', 'tomorrow', 'question', 'building', 'mountain', 'painting', 'sandwich', 'sunshine'],
                desc: '八个字母的词已经能占满一行。分成两段打：先打前半，再打后半。',
                hint: '把长词切成两三个小节，一节一节推进。'
            },
            {
                name: '九个字母以上', p: [9, 90], g: [510, 86, 50, 2.5, 0.6],
                words: ['important', 'beautiful', 'different', 'something', 'wonderful', 'dangerous', 'afternoon', 'telephone', 'chocolate', 'breakfast', 'classroom', 'favourite'],
                desc: '这些词有九个字母，读起来有节奏。按音节分组落键，会比硬拼快很多。',
                hint: '按音节分组：im-por-tant，一组一组来。'
            },
            {
                name: '终极混合', p: [9, 90], g: [540, 88, 52, 2.4, 0.65],
                words: ['university', 'restaurant', 'comfortable', 'understand', 'vegetables', 'everything', 'dictionary', 'information', 'celebration', 'grandfather', 'temperature', 'kindergarten'],
                desc: '最长的一组词，十个字母以上。手要放松，越紧张越容易在中间卡住。',
                hint: '肩膀放松，手指贴键，长词才打得动。'
            }
        ]
    }
];

/* ---------- 关卡生成 ---------- */
function padNo(n) { return n < 10 ? '0' + n : '' + n; }

function keysOfWords(words) {
    var out = [];
    words.forEach(function (w) {
        for (var i = 0; i < w.length; i++) {
            var c = w.charAt(i);
            if (out.indexOf(c) < 0) out.push(c);
        }
    });
    return out;
}

function makeLevel(def, n, chapter, ci) {
    var words = def.words ? def.words.slice() : null;
    var keys = words ? keysOfWords(words) : def.keys.slice();
    var caps = !!def.caps;
    return {
        id: 'l' + padNo(n), no: padNo(n), name: def.name, tag: '第 ' + n + ' 课',
        desc: def.desc, hint: def.hint,
        keys: caps ? keys.map(function (k) { return k.toUpperCase(); }) : keys,
        words: words, caps: caps, review: false,
        chapterIndex: ci, chapterNo: chapter.no, chapterName: chapter.name, chapterSub: chapter.sub,
        practice: { len: def.p[0], acc: def.p[1] },
        game: { mode: words ? 'words' : 'letters', target: def.g[0], time: def.g[1], speed: def.g[2], spawn: def.g[3], ramp: def.g[4], lives: 3 }
    };
}

/* 总结关：键位与词库只取本行前 4 课的并集，参数加严 */
function makeBoss(chapter, chLevels, n, ci) {
    var last = chLevels[chLevels.length - 1];
    var mode = last.game.mode;
    var keys = [], words = [];
    chLevels.forEach(function (l) {
        l.keys.forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
        if (l.words) l.words.forEach(function (w) { if (words.indexOf(w) < 0) words.push(w); });
    });
    var caps = chLevels.some(function (l) { return l.caps; });
    var g = last.game;
    var covers = chLevels.map(function (l) { return l.name; });
    var desc = '第 ' + chLevels[0].no + '–' + last.no + ' 课的内容全在这里：' +
        (mode === 'words' ? words.length + ' 个词' : keys.length + ' 个键') +
        '混在一起往下落，速度更快、目标更高、时间更长。不会出现没学过的新内容，考的就是这四课学得稳不稳。';

    return {
        id: 'l' + padNo(n), no: padNo(n), name: chapter.boss, tag: '总结关',
        desc: desc,
        hint: '这一关是考试：先求准，再求快，打错了宁愿慢一点。',
        keys: keys, words: mode === 'words' ? words : null, caps: caps, review: true,
        covers: covers,
        chapterIndex: ci, chapterNo: chapter.no, chapterName: chapter.name, chapterSub: chapter.sub,
        practice: { len: mode === 'words' ? 12 : 28, acc: mode === 'words' ? 88 : 86 },
        game: {
            mode: mode,
            target: Math.round(g.target * (mode === 'words' ? 1.5 : 1.45)),
            time: g.time + (mode === 'words' ? 12 : 10),
            speed: Math.round(g.speed * 1.15),
            spawn: mode === 'words' ? 2.1 : Math.round(g.spawn * 85) / 100,
            ramp: Math.round(g.ramp * 1.35 * 100) / 100,
            lives: 3
        }
    };
}

var LEVELS = [];
CHAPTERS.forEach(function (chapter, ci) {
    var chLevels = [];
    chapter.lessons.forEach(function (def) {
        var level = makeLevel(def, LEVELS.length + 1, chapter, ci);
        LEVELS.push(level);
        chLevels.push(level);
    });
    LEVELS.push(makeBoss(chapter, chLevels, LEVELS.length + 1, ci));
});

/* 段位（按 50 关的产出重新拉开） */
var RANKS = [
    { name: '键盘新手', xp: 0 },
    { name: '指尖学徒', xp: 150 },
    { name: '键位旅人', xp: 420 },
    { name: '盲打骑士', xp: 850 },
    { name: '闪电手指', xp: 1400 },
    { name: '打字大师', xp: 2100 },
    { name: '键界传说', xp: 3000 },
    { name: '键盘宗师', xp: 4200 }
];

var BADGES = [
    { id: 'first-start', name: '初次启航', desc: '完成第一次练习', icon: icon('flag') },
    { id: 'first-clear', name: '第一枚星', desc: '第一次通关一局游戏', icon: icon('coin') },
    { id: 'combo10', name: '十连击', desc: '单局打出 10 连击', icon: icon('bolt') },
    { id: 'combo25', name: '连击风暴', desc: '单局打出 25 连击', icon: icon('wave') },
    { id: 'perfect', name: '百发百中', desc: '零失误打完一局', icon: icon('target') },
    { id: 'keys1000', name: '千键之心', desc: '累计击键 1000 次', icon: icon('key') },
    { id: 'fast60', name: '闪电手', desc: '速度达到 60 字/分', icon: icon('fast') },
    { id: 'prac10', name: '练习狂人', desc: '累计完成 10 次练习', icon: icon('loop') },
    { id: 'game10', name: '游戏达人', desc: '累计打完 10 局游戏', icon: icon('pad') },
    { id: 'score1000', name: '千分俱乐部', desc: '累计得分超过 1000', icon: icon('coin') },
    { id: 'boss-first', name: '总结首胜', desc: '通关第一个总结关', icon: icon('crown') },
    { id: 'boss-all', name: '十战全胜', desc: '通关全部 10 个总结关', icon: icon('crown') },
    { id: 'clear-all', name: '五十关全通', desc: '通关全部 50 关', icon: icon('crown') },
    { id: 'streak3', name: '三日不辍', desc: '连续 3 天来练习', icon: icon('flame') }
];

var PRAISE = {
    pass: [
        '你真棒！这一遍的手型稳多了。',
        '手指记住路了，你又进步了。',
        '漂亮，就这么一个键一个键地啃下来。',
        '比刚才快了一点，这就是熟练的样子。'
    ],
    best: [
        '新纪录！你比上一局更快了。',
        '又刷新纪录，手指真的在长本事。',
        '这一局打得比之前都稳，记下来了。'
    ],
    win: [
        '通关！这一关的键位已经长在你手上了。',
        '漂亮的一局，连击都没怎么断。',
        '这关过了，下一关的键位在等你。',
        '就是这种手感，记住它。'
    ],
    boss: [
        '总结关拿下！前四课的内容你是真的记住了。',
        '这一关考的是四课的混合，你稳稳打完了。',
        '四课的东西混在一起也不乱，这就是进步。'
    ],
    fail: [
        '还差一点点，先去练一遍再回来。',
        '别急，先把每个键按准，速度是后面的事。',
        '再来一次，这次盯住最下面那个字母。'
    ]
};

/* ---------- 键位 → 手指 ----------
   按标准指法表排列：同一列上的数字、字母、标点归同一根手指。 */
var HAND = {
    /* 数字排 */
    '`': ['左手', '小指'], '1': ['左手', '小指'],
    '2': ['左手', '无名指'], '3': ['左手', '中指'],
    '4': ['左手', '食指'], '5': ['左手', '食指'],
    '6': ['右手', '食指'], '7': ['右手', '食指'],
    '8': ['右手', '中指'], '9': ['右手', '无名指'],
    '0': ['右手', '小指'], '-': ['右手', '小指'], '=': ['右手', '小指'],

    /* 上排 */
    'q': ['左手', '小指'], 'w': ['左手', '无名指'], 'e': ['左手', '中指'],
    'r': ['左手', '食指'], 't': ['左手', '食指'],
    'y': ['右手', '食指'], 'u': ['右手', '食指'], 'i': ['右手', '中指'],
    'o': ['右手', '无名指'], 'p': ['右手', '小指'],
    '[': ['右手', '小指'], ']': ['右手', '小指'], '\\': ['右手', '小指'],

    /* 主键区 */
    'a': ['左手', '小指'], 's': ['左手', '无名指'], 'd': ['左手', '中指'],
    'f': ['左手', '食指'], 'g': ['左手', '食指'],
    'h': ['右手', '食指'], 'j': ['右手', '食指'], 'k': ['右手', '中指'],
    'l': ['右手', '无名指'], ';': ['右手', '小指'], "'": ['右手', '小指'],

    /* 下排 */
    'z': ['左手', '小指'], 'x': ['左手', '无名指'], 'c': ['左手', '中指'],
    'v': ['左手', '食指'], 'b': ['左手', '食指'],
    'n': ['右手', '食指'], 'm': ['右手', '食指'],
    ',': ['右手', '中指'], '.': ['右手', '无名指'], '/': ['右手', '小指'],

    /* 空格 */
    ' ': ['双手', '大拇指']
};

/* ---------- 虚拟键盘：美式键盘（US ANSI）完整布局 ----------
   每一行合计 15 个单位格，w 就是键宽（格），gap 是行内留白。
   kind: 'char' 可打出字符的键 / 'fn' 功能键（Shift、Enter、空格等）
   sub: 按住 Shift 之后打出来的符号，显示在键帽左上角
   title: 鼠标悬停时给孩子看的说明 */
var KB_UNITS = 15;
var KB_LAYOUT = [
    /* 功能键行 */
    [
        { id: 'Esc', label: 'Esc', w: 1, kind: 'fn', title: 'Esc：退出 / 取消' },
        { gap: 1 },
        { id: 'F1', label: 'F1', w: 1, kind: 'fn' },
        { id: 'F2', label: 'F2', w: 1, kind: 'fn' },
        { id: 'F3', label: 'F3', w: 1, kind: 'fn' },
        { id: 'F4', label: 'F4', w: 1, kind: 'fn' },
        { gap: 0.5 },
        { id: 'F5', label: 'F5', w: 1, kind: 'fn' },
        { id: 'F6', label: 'F6', w: 1, kind: 'fn' },
        { id: 'F7', label: 'F7', w: 1, kind: 'fn' },
        { id: 'F8', label: 'F8', w: 1, kind: 'fn' },
        { gap: 0.5 },
        { id: 'F9', label: 'F9', w: 1, kind: 'fn' },
        { id: 'F10', label: 'F10', w: 1, kind: 'fn' },
        { id: 'F11', label: 'F11', w: 1, kind: 'fn' },
        { id: 'F12', label: 'F12', w: 1, kind: 'fn' }
    ],
    /* 数字排 */
    [
        { id: '`', label: '`', sub: '~', w: 1 },
        { id: '1', label: '1', sub: '!', w: 1 },
        { id: '2', label: '2', sub: '@', w: 1 },
        { id: '3', label: '3', sub: '#', w: 1 },
        { id: '4', label: '4', sub: '$', w: 1 },
        { id: '5', label: '5', sub: '%', w: 1 },
        { id: '6', label: '6', sub: '^', w: 1 },
        { id: '7', label: '7', sub: '&', w: 1 },
        { id: '8', label: '8', sub: '*', w: 1 },
        { id: '9', label: '9', sub: '(', w: 1 },
        { id: '0', label: '0', sub: ')', w: 1 },
        { id: '-', label: '-', sub: '_', w: 1 },
        { id: '=', label: '=', sub: '+', w: 1 },
        { id: 'Backspace', label: 'Backspace', labelSm: '⌫', w: 2, kind: 'fn', title: '退格：删掉左边一个字' }
    ],
    /* 字母上排 */
    [
        { id: 'Tab', label: 'Tab', w: 1.5, kind: 'fn', title: 'Tab：跳到下一格' },
        { id: 'q', label: 'Q', w: 1 },
        { id: 'w', label: 'W', w: 1 },
        { id: 'e', label: 'E', w: 1 },
        { id: 'r', label: 'R', w: 1 },
        { id: 't', label: 'T', w: 1 },
        { id: 'y', label: 'Y', w: 1 },
        { id: 'u', label: 'U', w: 1 },
        { id: 'i', label: 'I', w: 1 },
        { id: 'o', label: 'O', w: 1 },
        { id: 'p', label: 'P', w: 1 },
        { id: '[', label: '[', sub: '{', w: 1 },
        { id: ']', label: ']', sub: '}', w: 1 },
        { id: '\\', label: '\\', sub: '|', w: 1.5 }
    ],
    /* 基准键排 */
    [
        { id: 'CapsLock', label: 'Caps', w: 1.75, kind: 'fn', title: 'CapsLock：大写锁定' },
        { id: 'a', label: 'A', w: 1 },
        { id: 's', label: 'S', w: 1 },
        { id: 'd', label: 'D', w: 1 },
        { id: 'f', label: 'F', w: 1 },
        { id: 'g', label: 'G', w: 1 },
        { id: 'h', label: 'H', w: 1 },
        { id: 'j', label: 'J', w: 1 },
        { id: 'k', label: 'K', w: 1 },
        { id: 'l', label: 'L', w: 1 },
        { id: ';', label: ';', sub: ':', w: 1 },
        { id: "'", label: "'", sub: '"', w: 1 },
        { id: 'Enter', label: 'Enter', labelSm: '⏎', w: 2.25, kind: 'fn', title: '回车：换到下一行' }
    ],
    /* 下排 */
    [
        { id: 'ShiftLeft', label: 'Shift', w: 2.25, kind: 'fn', title: '左 Shift：按住再按字母打大写' },
        { id: 'z', label: 'Z', w: 1 },
        { id: 'x', label: 'X', w: 1 },
        { id: 'c', label: 'C', w: 1 },
        { id: 'v', label: 'V', w: 1 },
        { id: 'b', label: 'B', w: 1 },
        { id: 'n', label: 'N', w: 1 },
        { id: 'm', label: 'M', w: 1 },
        { id: ',', label: ',', sub: '<', w: 1 },
        { id: '.', label: '.', sub: '>', w: 1 },
        { id: '/', label: '/', sub: '?', w: 1 },
        { id: 'ShiftRight', label: 'Shift', w: 2.75, kind: 'fn', title: '右 Shift：右手小指压住再打字母' }
    ],
    /* 最底下这一排：空格在中间 */
    [
        { id: 'CtrlLeft', label: 'Ctrl', w: 1.25, kind: 'fn', title: 'Ctrl：控制键' },
        { id: 'WinLeft', label: 'Win', w: 1.25, kind: 'fn', title: 'Win：系统徽标键' },
        { id: 'AltLeft', label: 'Alt', w: 1.25, kind: 'fn', title: 'Alt：换挡键' },
        { id: ' ', label: '空格', w: 6.25, kind: 'fn', title: '空格：打出一个空白' },
        { id: 'AltRight', label: 'Alt', w: 1.25, kind: 'fn', title: 'Alt：换挡键' },
        { id: 'WinRight', label: 'Win', w: 1.25, kind: 'fn', title: 'Win：系统徽标键' },
        { id: 'Menu', label: 'Menu', w: 1.25, kind: 'fn', title: 'Menu：菜单键' },
        { id: 'CtrlRight', label: 'Ctrl', w: 1.25, kind: 'fn', title: 'Ctrl：控制键' }
    ]
];

/* 键盘顺序：让按键条按真实键盘的左右位置排，形成肌肉记忆 */
var KB_ORDER = (function () {
    var order = {}, i = 0;
    KB_LAYOUT.forEach(function (row) {
        row.forEach(function (k) {
            if (!k.gap) order[k.id] = i++;
        });
    });
    return order;
})();

/* ---------- 图标 ---------- */
function icon(kind) {
    var paths = {
        flag: 'M6 21V4l9 3-9 3',
        bolt: 'M13 3 5 13h6l-1 8 8-10h-6z',
        wave: 'M4 14c2-6 4-6 6 0s4 6 6 0',
        target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
        key: 'M14 9a3 3 0 1 0-6 0 3 3 0 0 0 6 0M9 12v7m3-3v3',
        fast: 'M4 17l6-6 4 3 6-7',
        loop: 'M5 12a7 7 0 0 1 12-5M19 12a7 7 0 0 1-12 5M17 4v4h-4M7 20v-4h4',
        pad: 'M4 9h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM9 13h2M10 12v2',
        coin: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 8v8',
        crown: 'M4 17l-1-9 5 4L12 5l4 7 5-4-1 9z',
        flame: 'M12 20c4 0 6-3 6-6 0-4-4-5-5-8-4 2-1 4 1 4 4 2'
    };
    return '<svg viewBox="0 0 24 24"><path d="' + (paths[kind] || paths.flag) + '"/></svg>';
}

var HEART = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.7-7-9.4A4 4 0 0 1 12 7a4 4 0 0 1 7 3.6c0 4.7-7 9.4-7 9.4z"/></svg>';
var LOCK = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v9H5z"/></svg>';
var CHECK = '<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 12.5l5 5L20 6.5"/></svg>';
var CROWN = icon('crown');

function starSvg(on) {
    return '<svg' + (on ? ' class="on"' : '') + ' viewBox="0 0 24 24"><path d="M12 3.2l2.6 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.5 7.8 20l1.1-6.1L4.4 9.6l6.1-.8z"/></svg>';
}
