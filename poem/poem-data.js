/* ============================================================
 * poem-data.js —— 小学唐诗共享题库
 *
 * 收录部编版小学语文 1-6 年级课文与常见日积月累中的唐诗，
 * 按「完整诗作」保存，题目从上句/下句的相邻句自动生成。
 *
 * 用法：
 *   PoemData.poems                 全部诗作
 *   PoemData.pickQuestion(random, { group, excludeUp })
 *   PoemData.questionCount(group)  某个年级组的题目数量
 *   PoemData.gradeText(grade)      一年级……
 * ============================================================ */
(function (global) {
    "use strict";

    var poems = [
        /* ---------- 低年级：一、二年级 ---------- */
        {
            title: "咏鹅", author: "骆宾王", grade: 1,
            lines: ["鹅，鹅，鹅", "曲项向天歌", "白毛浮绿水", "红掌拨清波"]
        },
        {
            title: "风", author: "李峤", grade: 1,
            lines: ["解落三秋叶", "能开二月花", "过江千尺浪", "入竹万竿斜"]
        },
        {
            title: "古朗月行（节选）", author: "李白", grade: 1,
            lines: ["小时不识月", "呼作白玉盘", "又疑瑶台镜", "飞在青云端"]
        },
        {
            title: "静夜思", author: "李白", grade: 1,
            lines: ["床前明月光", "疑是地上霜", "举头望明月", "低头思故乡"]
        },
        {
            title: "春晓", author: "孟浩然", grade: 1,
            lines: ["春眠不觉晓", "处处闻啼鸟", "夜来风雨声", "花落知多少"]
        },
        {
            title: "赠汪伦", author: "李白", grade: 1,
            lines: ["李白乘舟将欲行", "忽闻岸上踏歌声", "桃花潭水深千尺", "不及汪伦送我情"]
        },
        {
            title: "寻隐者不遇", author: "贾岛", grade: 1,
            lines: ["松下问童子", "言师采药去", "只在此山中", "云深不知处"]
        },
        {
            title: "池上", author: "白居易", grade: 1,
            lines: ["小娃撑小艇", "偷采白莲回", "不解藏踪迹", "浮萍一道开"]
        },
        {
            title: "悯农（其二）", author: "李绅", grade: 2,
            lines: ["锄禾日当午", "汗滴禾下土", "谁知盘中餐", "粒粒皆辛苦"]
        },
        {
            title: "悯农（其一）", author: "李绅", grade: 2,
            lines: ["春种一粒粟", "秋收万颗子", "四海无闲田", "农夫犹饿死"]
        },
        {
            title: "登鹳雀楼", author: "王之涣", grade: 2,
            lines: ["白日依山尽", "黄河入海流", "欲穷千里目", "更上一层楼"]
        },
        {
            title: "望庐山瀑布", author: "李白", grade: 2,
            lines: ["日照香炉生紫烟", "遥看瀑布挂前川", "飞流直下三千尺", "疑是银河落九天"]
        },
        {
            title: "江雪", author: "柳宗元", grade: 2,
            lines: ["千山鸟飞绝", "万径人踪灭", "孤舟蓑笠翁", "独钓寒江雪"]
        },
        {
            title: "夜宿山寺", author: "李白", grade: 2,
            lines: ["危楼高百尺", "手可摘星辰", "不敢高声语", "恐惊天上人"]
        },
        {
            title: "绝句（迟日江山丽）", author: "杜甫", grade: 2,
            lines: ["迟日江山丽", "春风花草香", "泥融飞燕子", "沙暖睡鸳鸯"]
        },
        {
            title: "咏柳", author: "贺知章", grade: 2,
            lines: ["碧玉妆成一树高", "万条垂下绿丝绦", "不知细叶谁裁出", "二月春风似剪刀"]
        },
        {
            title: "赋得古原草送别（节选）", author: "白居易", grade: 2,
            lines: ["离离原上草", "一岁一枯荣", "野火烧不尽", "春风吹又生"]
        },
        {
            title: "绝句（两个黄鹂鸣翠柳）", author: "杜甫", grade: 2,
            lines: ["两个黄鹂鸣翠柳", "一行白鹭上青天", "窗含西岭千秋雪", "门泊东吴万里船"]
        },
        {
            title: "回乡偶书", author: "贺知章", grade: 2,
            lines: ["少小离家老大回", "乡音无改鬓毛衰", "儿童相见不相识", "笑问客从何处来"]
        },

        /* ---------- 中年级：三、四年级 ---------- */
        {
            title: "小儿垂钓", author: "胡令能", grade: 2,
            lines: ["蓬头稚子学垂纶", "侧坐莓苔草映身", "路人借问遥招手", "怕得鱼惊不应人"]
        },
        {
            title: "山行", author: "杜牧", grade: 3,
            lines: ["远上寒山石径斜", "白云生处有人家", "停车坐爱枫林晚", "霜叶红于二月花"]
        },
        {
            title: "望天门山", author: "李白", grade: 3,
            lines: ["天门中断楚江开", "碧水东流至此回", "两岸青山相对出", "孤帆一片日边来"]
        },
        {
            title: "望洞庭", author: "刘禹锡", grade: 3,
            lines: ["湖光秋月两相和", "潭面无风镜未磨", "遥望洞庭山水翠", "白银盘里一青螺"]
        },
        {
            title: "早发白帝城", author: "李白", grade: 3,
            lines: ["朝辞白帝彩云间", "千里江陵一日还", "两岸猿声啼不住", "轻舟已过万重山"]
        },
        {
            title: "清明", author: "杜牧", grade: 3,
            lines: ["清明时节雨纷纷", "路上行人欲断魂", "借问酒家何处有", "牧童遥指杏花村"]
        },
        {
            title: "九月九日忆山东兄弟", author: "王维", grade: 3,
            lines: ["独在异乡为异客", "每逢佳节倍思亲", "遥知兄弟登高处", "遍插茱萸少一人"]
        },
        {
            title: "滁州西涧", author: "韦应物", grade: 3,
            lines: ["独怜幽草涧边生", "上有黄鹂深树鸣", "春潮带雨晚来急", "野渡无人舟自横"]
        },
        {
            title: "大林寺桃花", author: "白居易", grade: 3,
            lines: ["人间四月芳菲尽", "山寺桃花始盛开", "长恨春归无觅处", "不知转入此中来"]
        },
        {
            title: "采莲曲", author: "王昌龄", grade: 3,
            lines: ["荷叶罗裙一色裁", "芙蓉向脸两边开", "乱入池中看不见", "闻歌始觉有人来"]
        },
        {
            title: "浪淘沙（其七）", author: "刘禹锡", grade: 4,
            lines: ["八月涛声吼地来", "头高数丈触山回", "须臾却入海门去", "卷起沙堆似雪堆"]
        },
        {
            title: "鹿柴", author: "王维", grade: 4,
            lines: ["空山不见人", "但闻人语响", "返景入深林", "复照青苔上"]
        },
        {
            title: "嫦娥", author: "李商隐", grade: 4,
            lines: ["云母屏风烛影深", "长河渐落晓星沉", "嫦娥应悔偷灵药", "碧海青天夜夜心"]
        },
        {
            title: "出塞", author: "王昌龄", grade: 4,
            lines: ["秦时明月汉时关", "万里长征人未还", "但使龙城飞将在", "不教胡马度阴山"]
        },
        {
            title: "凉州词", author: "王翰", grade: 4,
            lines: ["葡萄美酒夜光杯", "欲饮琵琶马上催", "醉卧沙场君莫笑", "古来征战几人回"]
        },
        {
            title: "独坐敬亭山", author: "李白", grade: 4,
            lines: ["众鸟高飞尽", "孤云独去闲", "相看两不厌", "只有敬亭山"]
        },
        {
            title: "江南春", author: "杜牧", grade: 4,
            lines: ["千里莺啼绿映红", "水村山郭酒旗风", "南朝四百八十寺", "多少楼台烟雨中"]
        },
        {
            title: "江畔独步寻花", author: "杜甫", grade: 4,
            lines: ["黄四娘家花满蹊", "千朵万朵压枝低", "留连戏蝶时时舞", "自在娇莺恰恰啼"]
        },
        {
            title: "蜂", author: "罗隐", grade: 4,
            lines: ["不论平地与山尖", "无限风光尽被占", "采得百花成蜜后", "为谁辛苦为谁甜"]
        },

        {
            title: "暮江吟", author: "白居易", grade: 4,
            lines: ["一道残阳铺水中", "半江瑟瑟半江红", "可怜九月初三夜", "露似真珠月似弓"]
        },
        /* ---------- 高年级：五、六年级 ---------- */
        {
            title: "乞巧", author: "林杰", grade: 5,
            lines: ["七夕今宵看碧霄", "牵牛织女渡河桥", "家家乞巧望秋月", "穿尽红丝几万条"]
        },
        {
            title: "山居秋暝", author: "王维", grade: 5,
            lines: ["空山新雨后", "天气晚来秋", "明月松间照", "清泉石上流",
                "竹喧归浣女", "莲动下渔舟", "随意春芳歇", "王孙自可留"]
        },
        {
            title: "枫桥夜泊", author: "张继", grade: 5,
            lines: ["月落乌啼霜满天", "江枫渔火对愁眠", "姑苏城外寒山寺", "夜半钟声到客船"]
        },
        {
            title: "黄鹤楼送孟浩然之广陵", author: "李白", grade: 5,
            lines: ["故人西辞黄鹤楼", "烟花三月下扬州", "孤帆远影碧空尽", "唯见长江天际流"]
        },
        {
            title: "凉州词", author: "王之涣", grade: 5,
            lines: ["黄河远上白云间", "一片孤城万仞山", "羌笛何须怨杨柳", "春风不度玉门关"]
        },
        {
            title: "闻官军收河南河北", author: "杜甫", grade: 5,
            lines: ["剑外忽传收蓟北", "初闻涕泪满衣裳", "却看妻子愁何在", "漫卷诗书喜欲狂",
                "白日放歌须纵酒", "青春作伴好还乡", "即从巴峡穿巫峡", "便下襄阳向洛阳"]
        },
        {
            title: "从军行", author: "王昌龄", grade: 5,
            lines: ["青海长云暗雪山", "孤城遥望玉门关", "黄沙百战穿金甲", "不破楼兰终不还"]
        },
        {
            title: "别董大", author: "高适", grade: 5,
            lines: ["千里黄云白日曛", "北风吹雁雪纷纷", "莫愁前路无知己", "天下谁人不识君"]
        },
        {
            title: "游子吟", author: "孟郊", grade: 5,
            lines: ["慈母手中线", "游子身上衣", "临行密密缝", "意恐迟迟归",
                "谁言寸草心", "报得三春晖"]
        },
        {
            title: "塞下曲", author: "卢纶", grade: 5,
            lines: ["月黑雁飞高", "单于夜遁逃", "欲将轻骑逐", "大雪满弓刀"]
        },
        {
            title: "蝉", author: "虞世南", grade: 5,
            lines: ["垂緌饮清露", "流响出疏桐", "居高声自远", "非是藉秋风"]
        },
        {
            title: "寒食", author: "韩翃", grade: 6,
            lines: ["春城无处不飞花", "寒食东风御柳斜", "日暮汉宫传蜡烛", "轻烟散入五侯家"]
        },
        {
            title: "十五夜望月", author: "王建", grade: 6,
            lines: ["中庭地白树栖鸦", "冷露无声湿桂花", "今夜月明人尽望", "不知秋思落谁家"]
        },
        {
            title: "马诗", author: "李贺", grade: 6,
            lines: ["大漠沙如雪", "燕山月似钩", "何当金络脑", "快走踏清秋"]
        },
        {
            title: "宿建德江", author: "孟浩然", grade: 6,
            lines: ["移舟泊烟渚", "日暮客愁新", "野旷天低树", "江清月近人"]
        },
        {
            title: "过故人庄", author: "孟浩然", grade: 6,
            lines: ["故人具鸡黍", "邀我至田家", "绿树村边合", "青山郭外斜",
                "开轩面场圃", "把酒话桑麻", "待到重阳日", "还来就菊花"]
        },
        {
            title: "春夜喜雨", author: "杜甫", grade: 6,
            lines: ["好雨知时节", "当春乃发生", "随风潜入夜", "润物细无声",
                "野径云俱黑", "江船火独明", "晓看红湿处", "花重锦官城"]
        },
        {
            title: "早春呈水部张十八员外", author: "韩愈", grade: 6,
            lines: ["天街小雨润如酥", "草色遥看近却无", "最是一年春好处", "绝胜烟柳满皇都"]
        },
        {
            title: "夜雨寄北", author: "李商隐", grade: 6,
            lines: ["君问归期未有期", "巴山夜雨涨秋池", "何当共剪西窗烛", "却话巴山夜雨时"]
        },
        {
            title: "送元二使安西", author: "王维", grade: 6,
            lines: ["渭城朝雨浥轻尘", "客舍青青柳色新", "劝君更尽一杯酒", "西出阳关无故人"]
        },
        {
            title: "竹里馆", author: "王维", grade: 6,
            lines: ["独坐幽篁里", "弹琴复长啸", "深林人不知", "明月来相照"]
        },
        {
            title: "芙蓉楼送辛渐", author: "王昌龄", grade: 6,
            lines: ["寒雨连江夜入吴", "平明送客楚山孤", "洛阳亲友如相问", "一片冰心在玉壶"]
        },
        {
            title: "鸟鸣涧", author: "王维", grade: 6,
            lines: ["人闲桂花落", "夜静春山空", "月出惊山鸟", "时鸣春涧中"]
        },
        {
            title: "逢雪宿芙蓉山主人", author: "刘长卿", grade: 6,
            lines: ["日暮苍山远", "天寒白屋贫", "柴门闻犬吠", "风雪夜归人"]
        },
        {
            title: "秋浦歌", author: "李白", grade: 6,
            lines: ["白发三千丈", "缘愁似个长", "不知明镜里", "何处得秋霜"]
        }
    ];

    /* ---------------- 工具 ---------------- */

    function stripPunctuation(text) {
        return String(text || "").replace(/[，。？！、；：“”‘’（）《》〈〉·—…\s]/g, "");
    }

    function lengthOf(text) {
        return stripPunctuation(text).length;
    }

    function gradeGroup(grade) {
        if (grade <= 2) return "low";
        if (grade <= 4) return "mid";
        return "high";
    }

    function gradeText(grade) {
        return ["", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级"][grade] || "";
    }

    function inGroup(grade, group) {
        if (!group || group === "all") return true;
        return gradeGroup(grade) === group;
    }

    var pairCache = null;

    function pairs() {
        if (pairCache) return pairCache;
        var out = [];
        poems.forEach(function (poem) {
            for (var i = 1; i < poem.lines.length; i++) {
                var up = poem.lines[i - 1];
                var down = poem.lines[i];
                if (!up || !down) continue;
                out.push({
                    up: up,
                    down: down,
                    title: poem.title,
                    author: poem.author,
                    grade: poem.grade,
                    length: lengthOf(down)
                });
            }
        });
        pairCache = out;
        return out;
    }

    function shuffle(items, random) {
        var arr = items.slice();
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(random() * (i + 1));
            if (j >= i) j = i - 1;
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    function pick(items, random) {
        if (!items.length) return null;
        var index = Math.floor(random() * items.length);
        if (index >= items.length) index = items.length - 1;
        return items[index];
    }

    function questionPool(group, excludeUp) {
        var all = pairs();
        var pool = all.filter(function (item) {
            return inGroup(item.grade, group) && item.up !== excludeUp;
        });
        if (!pool.length) {
            pool = all.filter(function (item) {
                return inGroup(item.grade, group);
            });
        }
        if (!pool.length) pool = all;
        return pool;
    }

    /**
     * 随机生成一道「上句 → 下句」四选一题。
     * @param {Function} random 随机函数，默认 Math.random
     * @param {Object} options { group: "all"|"low"|"mid"|"high", excludeUp: String }
     */
    function pickQuestion(random, options) {
        random = typeof random === "function" ? random : Math.random;
        options = options || {};
        var answer = pick(questionPool(options.group, options.excludeUp), random);
        if (!answer) return null;

        var all = pairs();
        var used = {};
        var distractors = [];

        // 优先选字数相同、不同诗作的句子，选项更像同一类诗
        var sameLength = all.filter(function (item) {
            return item.down !== answer.down &&
                item.title !== answer.title &&
                item.length === answer.length &&
                inGroup(item.grade, options.group);
        });
        shuffle(sameLength, random).some(function (item) {
            if (used[item.down]) return false;
            used[item.down] = true;
            distractors.push(item.down);
            return distractors.length >= 3;
        });

        if (distractors.length < 3) {
            var fallback = all.filter(function (item) {
                return item.down !== answer.down && inGroup(item.grade, options.group);
            });
            shuffle(fallback, random).some(function (item) {
                if (used[item.down]) return false;
                used[item.down] = true;
                distractors.push(item.down);
                return distractors.length >= 3;
            });
        }

        // 当前分组仍不足时跨年级补齐，保证始终四个不重复选项
        if (distractors.length < 3) {
            var crossGrade = all.filter(function (item) {
                return item.down !== answer.down;
            });
            shuffle(crossGrade, random).some(function (item) {
                if (used[item.down]) return false;
                used[item.down] = true;
                distractors.push(item.down);
                return distractors.length >= 3;
            });
        }

        var choices = [{ text: answer.down, right: true }];
        distractors.forEach(function (text) {
            choices.push({ text: text, right: false });
        });

        return {
            up: answer.up,
            down: answer.down,
            title: answer.title,
            author: answer.author,
            grade: answer.grade,
            length: answer.length,
            options: shuffle(choices, random)
        };
    }

    function questionCount(group) {
        return pairs().filter(function (item) {
            return inGroup(item.grade, group);
        }).length;
    }

    global.PoemData = {
        version: 1,
        poems: poems,
        pairs: pairs,
        pickQuestion: pickQuestion,
        questionCount: questionCount,
        count: poems.length,
        stripPunctuation: stripPunctuation,
        lengthOf: lengthOf,
        gradeGroup: gradeGroup,
        gradeText: gradeText,
        inGroup: inGroup,
        groups: [
            { id: "all", label: "全部" },
            { id: "low", label: "一、二年级" },
            { id: "mid", label: "三、四年级" },
            { id: "high", label: "五、六年级" }
        ]
    };
})(typeof window !== "undefined" ? window : globalThis);
