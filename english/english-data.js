/* ============================================================
 * english-data.js —— 小学 1-3 年级英语单词共享词库
 *
 * 每条记录：
 *   w    单词
 *   zh   中文意思（多个义项用「；」分隔）
 *   g    难度级别：1=一年级 2=二年级 3=三年级
 *   c    主题分类
 *   ipa  音标
 *   syl  音节拼读（用 - 切分，供「拼读条」展示）
 *
 * 对外接口：
 *   EnglishData.words                    全部单词
 *   EnglishData.grades                   年级列表
 *   EnglishData.categories               主题分类
 *   EnglishData.filter({grades})         按年级筛词
 *   EnglishData.count(grades)            某个范围的单词数
 *   EnglishData.gradeText(g)             1 → 一年级
 *   EnglishData.phonicsHint(word, ipa)   按拼写与音标给出自然拼读提示
 *   EnglishData.makeQuestion(type, opts) 生成一道题（游戏与门禁共用）
 *
 * 题型 type：
 *   en2zh        英翻中（四选一）
 *   zh2en        中翻英（四选一）
 *   zh2en-write  中翻英（手写拼写）
 *   fill-choice  补全单词（四选一补后半段）
 *   fill-write   补全单词（手写补后半段）
 * ============================================================ */
(function (global) {
    "use strict";

    var words = [
        /* ---------------- 一年级 ---------------- */
        /* 问候与人物 */
        { w: "hello", zh: "你好", g: 1, c: "问候", ipa: "/ˈheləʊ/", syl: "hel-lo" },
        { w: "hi", zh: "嗨；你好", g: 1, c: "问候", ipa: "/haɪ/", syl: "hi" },
        { w: "goodbye", zh: "再见", g: 1, c: "问候", ipa: "/ˌɡʊdˈbaɪ/", syl: "good-bye" },
        { w: "bye", zh: "再见", g: 1, c: "问候", ipa: "/baɪ/", syl: "bye" },
        { w: "morning", zh: "早晨", g: 1, c: "时间", ipa: "/ˈmɔːnɪŋ/", syl: "morn-ing" },
        { w: "afternoon", zh: "下午", g: 1, c: "时间", ipa: "/ˌɑːftəˈnuːn/", syl: "af-ter-noon" },
        { w: "evening", zh: "傍晚；晚上", g: 1, c: "时间", ipa: "/ˈiːvnɪŋ/", syl: "eve-ning" },
        { w: "night", zh: "夜晚", g: 1, c: "时间", ipa: "/naɪt/", syl: "night" },
        { w: "name", zh: "名字", g: 1, c: "人物", ipa: "/neɪm/", syl: "name" },
        { w: "friend", zh: "朋友", g: 1, c: "人物", ipa: "/frend/", syl: "friend" },
        { w: "boy", zh: "男孩", g: 1, c: "人物", ipa: "/bɔɪ/", syl: "boy" },
        { w: "girl", zh: "女孩", g: 1, c: "人物", ipa: "/ɡɜːl/", syl: "girl" },
        { w: "teacher", zh: "老师", g: 1, c: "人物", ipa: "/ˈtiːtʃə/", syl: "teach-er" },
        { w: "student", zh: "学生", g: 1, c: "人物", ipa: "/ˈstjuːdənt/", syl: "stu-dent" },
        { w: "baby", zh: "婴儿", g: 1, c: "人物", ipa: "/ˈbeɪbi/", syl: "ba-by" },
        { w: "family", zh: "家庭", g: 1, c: "家庭", ipa: "/ˈfæməli/", syl: "fam-i-ly" },
        { w: "mother", zh: "妈妈", g: 1, c: "家庭", ipa: "/ˈmʌðə/", syl: "moth-er" },
        { w: "father", zh: "爸爸", g: 1, c: "家庭", ipa: "/ˈfɑːðə/", syl: "fa-ther" },
        { w: "sister", zh: "姐姐；妹妹", g: 1, c: "家庭", ipa: "/ˈsɪstə/", syl: "sis-ter" },
        { w: "brother", zh: "哥哥；弟弟", g: 1, c: "家庭", ipa: "/ˈbrʌðə/", syl: "broth-er" },
        { w: "grandma", zh: "奶奶；外婆", g: 1, c: "家庭", ipa: "/ˈɡrænmɑː/", syl: "grand-ma" },
        { w: "grandpa", zh: "爷爷；外公", g: 1, c: "家庭", ipa: "/ˈɡrænpɑː/", syl: "grand-pa" },

        /* 数字 */
        { w: "one", zh: "一", g: 1, c: "数字", ipa: "/wʌn/", syl: "one" },
        { w: "two", zh: "二", g: 1, c: "数字", ipa: "/tuː/", syl: "two" },
        { w: "three", zh: "三", g: 1, c: "数字", ipa: "/θriː/", syl: "three" },
        { w: "four", zh: "四", g: 1, c: "数字", ipa: "/fɔː/", syl: "four" },
        { w: "five", zh: "五", g: 1, c: "数字", ipa: "/faɪv/", syl: "five" },
        { w: "six", zh: "六", g: 1, c: "数字", ipa: "/sɪks/", syl: "six" },
        { w: "seven", zh: "七", g: 1, c: "数字", ipa: "/ˈsevn/", syl: "sev-en" },
        { w: "eight", zh: "八", g: 1, c: "数字", ipa: "/eɪt/", syl: "eight" },
        { w: "nine", zh: "九", g: 1, c: "数字", ipa: "/naɪn/", syl: "nine" },
        { w: "ten", zh: "十", g: 1, c: "数字", ipa: "/ten/", syl: "ten" },

        /* 颜色 */
        { w: "red", zh: "红色", g: 1, c: "颜色", ipa: "/red/", syl: "red" },
        { w: "yellow", zh: "黄色", g: 1, c: "颜色", ipa: "/ˈjeləʊ/", syl: "yel-low" },
        { w: "blue", zh: "蓝色", g: 1, c: "颜色", ipa: "/bluː/", syl: "blue" },
        { w: "green", zh: "绿色", g: 1, c: "颜色", ipa: "/ɡriːn/", syl: "green" },
        { w: "black", zh: "黑色", g: 1, c: "颜色", ipa: "/blæk/", syl: "black" },
        { w: "white", zh: "白色", g: 1, c: "颜色", ipa: "/waɪt/", syl: "white" },
        { w: "pink", zh: "粉色", g: 1, c: "颜色", ipa: "/pɪŋk/", syl: "pink" },
        { w: "brown", zh: "棕色；咖啡色", g: 1, c: "颜色", ipa: "/braʊn/", syl: "brown" },
        { w: "purple", zh: "紫色", g: 1, c: "颜色", ipa: "/ˈpɜːpl/", syl: "pur-ple" },

        /* 动物 */
        { w: "cat", zh: "猫", g: 1, c: "动物", ipa: "/kæt/", syl: "cat" },
        { w: "dog", zh: "狗", g: 1, c: "动物", ipa: "/dɒɡ/", syl: "dog" },
        { w: "bird", zh: "鸟", g: 1, c: "动物", ipa: "/bɜːd/", syl: "bird" },
        { w: "fish", zh: "鱼", g: 1, c: "动物", ipa: "/fɪʃ/", syl: "fish" },
        { w: "duck", zh: "鸭子", g: 1, c: "动物", ipa: "/dʌk/", syl: "duck" },
        { w: "pig", zh: "猪", g: 1, c: "动物", ipa: "/pɪɡ/", syl: "pig" },
        { w: "cow", zh: "奶牛", g: 1, c: "动物", ipa: "/kaʊ/", syl: "cow" },
        { w: "horse", zh: "马", g: 1, c: "动物", ipa: "/hɔːs/", syl: "horse" },
        { w: "rabbit", zh: "兔子", g: 1, c: "动物", ipa: "/ˈræbɪt/", syl: "rab-bit" },
        { w: "monkey", zh: "猴子", g: 1, c: "动物", ipa: "/ˈmʌŋki/", syl: "mon-key" },
        { w: "tiger", zh: "老虎", g: 1, c: "动物", ipa: "/ˈtaɪɡə/", syl: "ti-ger" },
        { w: "panda", zh: "熊猫", g: 1, c: "动物", ipa: "/ˈpændə/", syl: "pan-da" },
        { w: "elephant", zh: "大象", g: 1, c: "动物", ipa: "/ˈelɪfənt/", syl: "el-e-phant" },
        { w: "bear", zh: "熊", g: 1, c: "动物", ipa: "/beə/", syl: "bear" },
        { w: "mouse", zh: "老鼠", g: 1, c: "动物", ipa: "/maʊs/", syl: "mouse" },
        { w: "sheep", zh: "绵羊", g: 1, c: "动物", ipa: "/ʃiːp/", syl: "sheep" },
        { w: "frog", zh: "青蛙", g: 1, c: "动物", ipa: "/frɒɡ/", syl: "frog" },
        { w: "bee", zh: "蜜蜂", g: 1, c: "动物", ipa: "/biː/", syl: "bee" },

        /* 身体 */
        { w: "head", zh: "头", g: 1, c: "身体", ipa: "/hed/", syl: "head" },
        { w: "face", zh: "脸", g: 1, c: "身体", ipa: "/feɪs/", syl: "face" },
        { w: "eye", zh: "眼睛", g: 1, c: "身体", ipa: "/aɪ/", syl: "eye" },
        { w: "ear", zh: "耳朵", g: 1, c: "身体", ipa: "/ɪə/", syl: "ear" },
        { w: "nose", zh: "鼻子", g: 1, c: "身体", ipa: "/nəʊz/", syl: "nose" },
        { w: "mouth", zh: "嘴巴", g: 1, c: "身体", ipa: "/maʊθ/", syl: "mouth" },
        { w: "hand", zh: "手", g: 1, c: "身体", ipa: "/hænd/", syl: "hand" },
        { w: "arm", zh: "手臂", g: 1, c: "身体", ipa: "/ɑːm/", syl: "arm" },
        { w: "leg", zh: "腿", g: 1, c: "身体", ipa: "/leɡ/", syl: "leg" },
        { w: "foot", zh: "脚", g: 1, c: "身体", ipa: "/fʊt/", syl: "foot" },
        { w: "hair", zh: "头发", g: 1, c: "身体", ipa: "/heə/", syl: "hair" },

        /* 食物 */
        { w: "apple", zh: "苹果", g: 1, c: "食物", ipa: "/ˈæpl/", syl: "ap-ple" },
        { w: "banana", zh: "香蕉", g: 1, c: "食物", ipa: "/bəˈnɑːnə/", syl: "ba-na-na" },
        { w: "pear", zh: "梨", g: 1, c: "食物", ipa: "/peə/", syl: "pear" },
        { w: "orange", zh: "橙子；橙色", g: 1, c: "食物", ipa: "/ˈɒrɪndʒ/", syl: "or-ange" },
        { w: "milk", zh: "牛奶", g: 1, c: "食物", ipa: "/mɪlk/", syl: "milk" },
        { w: "egg", zh: "鸡蛋", g: 1, c: "食物", ipa: "/eɡ/", syl: "egg" },
        { w: "rice", zh: "米饭", g: 1, c: "食物", ipa: "/raɪs/", syl: "rice" },
        { w: "cake", zh: "蛋糕", g: 1, c: "食物", ipa: "/keɪk/", syl: "cake" },
        { w: "bread", zh: "面包", g: 1, c: "食物", ipa: "/bred/", syl: "bread" },
        { w: "water", zh: "水", g: 1, c: "食物", ipa: "/ˈwɔːtə/", syl: "wa-ter" },
        { w: "juice", zh: "果汁", g: 1, c: "食物", ipa: "/dʒuːs/", syl: "juice" },
        { w: "candy", zh: "糖果", g: 1, c: "食物", ipa: "/ˈkændi/", syl: "can-dy" },
        { w: "cookie", zh: "饼干", g: 1, c: "食物", ipa: "/ˈkʊki/", syl: "cook-ie" },

        /* 学校 */
        { w: "school", zh: "学校", g: 1, c: "学校", ipa: "/skuːl/", syl: "school" },
        { w: "book", zh: "书", g: 1, c: "学校", ipa: "/bʊk/", syl: "book" },
        { w: "pen", zh: "钢笔", g: 1, c: "学校", ipa: "/pen/", syl: "pen" },
        { w: "pencil", zh: "铅笔", g: 1, c: "学校", ipa: "/ˈpensl/", syl: "pen-cil" },
        { w: "bag", zh: "书包；包", g: 1, c: "学校", ipa: "/bæɡ/", syl: "bag" },
        { w: "ruler", zh: "尺子", g: 1, c: "学校", ipa: "/ˈruːlə/", syl: "ru-ler" },
        { w: "eraser", zh: "橡皮", g: 1, c: "学校", ipa: "/ɪˈreɪzə/", syl: "e-ras-er" },
        { w: "desk", zh: "课桌", g: 1, c: "学校", ipa: "/desk/", syl: "desk" },
        { w: "chair", zh: "椅子", g: 1, c: "学校", ipa: "/tʃeə/", syl: "chair" },
        { w: "class", zh: "班级；课", g: 1, c: "学校", ipa: "/klɑːs/", syl: "class" },
        { w: "crayon", zh: "蜡笔", g: 1, c: "学校", ipa: "/ˈkreɪən/", syl: "cray-on" },

        /* 玩具 */
        { w: "ball", zh: "球", g: 1, c: "玩具", ipa: "/bɔːl/", syl: "ball" },
        { w: "doll", zh: "洋娃娃", g: 1, c: "玩具", ipa: "/dɒl/", syl: "doll" },
        { w: "car", zh: "小汽车", g: 1, c: "玩具", ipa: "/kɑː/", syl: "car" },
        { w: "kite", zh: "风筝", g: 1, c: "玩具", ipa: "/kaɪt/", syl: "kite" },
        { w: "toy", zh: "玩具", g: 1, c: "玩具", ipa: "/tɔɪ/", syl: "toy" },
        { w: "balloon", zh: "气球", g: 1, c: "玩具", ipa: "/bəˈluːn/", syl: "bal-loon" },
        { w: "robot", zh: "机器人", g: 1, c: "玩具", ipa: "/ˈrəʊbɒt/", syl: "ro-bot" },

        /* 形容词 */
        { w: "big", zh: "大的", g: 1, c: "形容词", ipa: "/bɪɡ/", syl: "big" },
        { w: "small", zh: "小的", g: 1, c: "形容词", ipa: "/smɔːl/", syl: "small" },
        { w: "long", zh: "长的", g: 1, c: "形容词", ipa: "/lɒŋ/", syl: "long" },
        { w: "short", zh: "短的；矮的", g: 1, c: "形容词", ipa: "/ʃɔːt/", syl: "short" },
        { w: "tall", zh: "高的", g: 1, c: "形容词", ipa: "/tɔːl/", syl: "tall" },
        { w: "happy", zh: "开心的", g: 1, c: "形容词", ipa: "/ˈhæpi/", syl: "hap-py" },
        { w: "sad", zh: "难过的", g: 1, c: "形容词", ipa: "/sæd/", syl: "sad" },
        { w: "hot", zh: "热的", g: 1, c: "形容词", ipa: "/hɒt/", syl: "hot" },
        { w: "cold", zh: "冷的", g: 1, c: "形容词", ipa: "/kəʊld/", syl: "cold" },
        { w: "new", zh: "新的", g: 1, c: "形容词", ipa: "/njuː/", syl: "new" },
        { w: "old", zh: "旧的；年老的", g: 1, c: "形容词", ipa: "/əʊld/", syl: "old" },
        { w: "good", zh: "好的", g: 1, c: "形容词", ipa: "/ɡʊd/", syl: "good" },
        { w: "cute", zh: "可爱的", g: 1, c: "形容词", ipa: "/kjuːt/", syl: "cute" },
        { w: "nice", zh: "美好的；友善的", g: 1, c: "形容词", ipa: "/naɪs/", syl: "nice" },

        /* ---------------- 二年级 ---------------- */
        /* 星期与时间 */
        { w: "Monday", zh: "星期一", g: 2, c: "时间", ipa: "/ˈmʌndeɪ/", syl: "Mon-day" },
        { w: "Tuesday", zh: "星期二", g: 2, c: "时间", ipa: "/ˈtjuːzdeɪ/", syl: "Tues-day" },
        { w: "Wednesday", zh: "星期三", g: 2, c: "时间", ipa: "/ˈwednzdeɪ/", syl: "Wed-nes-day" },
        { w: "Thursday", zh: "星期四", g: 2, c: "时间", ipa: "/ˈθɜːzdeɪ/", syl: "Thurs-day" },
        { w: "Friday", zh: "星期五", g: 2, c: "时间", ipa: "/ˈfraɪdeɪ/", syl: "Fri-day" },
        { w: "Saturday", zh: "星期六", g: 2, c: "时间", ipa: "/ˈsætədeɪ/", syl: "Sat-ur-day" },
        { w: "Sunday", zh: "星期日", g: 2, c: "时间", ipa: "/ˈsʌndeɪ/", syl: "Sun-day" },
        { w: "week", zh: "星期；周", g: 2, c: "时间", ipa: "/wiːk/", syl: "week" },
        { w: "day", zh: "天；白天", g: 2, c: "时间", ipa: "/deɪ/", syl: "day" },
        { w: "today", zh: "今天", g: 2, c: "时间", ipa: "/təˈdeɪ/", syl: "to-day" },
        { w: "tomorrow", zh: "明天", g: 2, c: "时间", ipa: "/təˈmɒrəʊ/", syl: "to-mor-row" },

        /* 天气 */
        { w: "weather", zh: "天气", g: 2, c: "天气", ipa: "/ˈweðə/", syl: "weath-er" },
        { w: "sunny", zh: "晴朗的", g: 2, c: "天气", ipa: "/ˈsʌni/", syl: "sun-ny" },
        { w: "rainy", zh: "下雨的", g: 2, c: "天气", ipa: "/ˈreɪni/", syl: "rain-y" },
        { w: "cloudy", zh: "多云的", g: 2, c: "天气", ipa: "/ˈklaʊdi/", syl: "cloud-y" },
        { w: "windy", zh: "有风的", g: 2, c: "天气", ipa: "/ˈwɪndi/", syl: "wind-y" },
        { w: "snowy", zh: "下雪的", g: 2, c: "天气", ipa: "/ˈsnəʊi/", syl: "snow-y" },
        { w: "warm", zh: "温暖的", g: 2, c: "天气", ipa: "/wɔːm/", syl: "warm" },
        { w: "cool", zh: "凉爽的", g: 2, c: "天气", ipa: "/kuːl/", syl: "cool" },

        /* 衣服 */
        { w: "shirt", zh: "衬衫", g: 2, c: "衣服", ipa: "/ʃɜːt/", syl: "shirt" },
        { w: "T-shirt", zh: "T 恤衫", g: 2, c: "衣服", ipa: "/ˈtiːʃɜːt/", syl: "T-shirt" },
        { w: "skirt", zh: "短裙", g: 2, c: "衣服", ipa: "/skɜːt/", syl: "skirt" },
        { w: "dress", zh: "连衣裙", g: 2, c: "衣服", ipa: "/dres/", syl: "dress" },
        { w: "coat", zh: "外套", g: 2, c: "衣服", ipa: "/kəʊt/", syl: "coat" },
        { w: "hat", zh: "帽子", g: 2, c: "衣服", ipa: "/hæt/", syl: "hat" },
        { w: "shoes", zh: "鞋子", g: 2, c: "衣服", ipa: "/ʃuːz/", syl: "shoes" },
        { w: "socks", zh: "袜子", g: 2, c: "衣服", ipa: "/sɒks/", syl: "socks" },
        { w: "pants", zh: "裤子", g: 2, c: "衣服", ipa: "/pænts/", syl: "pants" },
        { w: "sweater", zh: "毛衣", g: 2, c: "衣服", ipa: "/ˈswetə/", syl: "sweat-er" },

        /* 食物 */
        { w: "noodles", zh: "面条", g: 2, c: "食物", ipa: "/ˈnuːdlz/", syl: "noo-dles" },
        { w: "hamburger", zh: "汉堡包", g: 2, c: "食物", ipa: "/ˈhæmbɜːɡə/", syl: "ham-bur-ger" },
        { w: "chicken", zh: "鸡肉", g: 2, c: "食物", ipa: "/ˈtʃɪkɪn/", syl: "chick-en" },
        { w: "vegetable", zh: "蔬菜", g: 2, c: "食物", ipa: "/ˈvedʒtəbl/", syl: "veg-e-ta-ble" },
        { w: "fruit", zh: "水果", g: 2, c: "食物", ipa: "/fruːt/", syl: "fruit" },
        { w: "soup", zh: "汤", g: 2, c: "食物", ipa: "/suːp/", syl: "soup" },
        { w: "potato", zh: "土豆", g: 2, c: "食物", ipa: "/pəˈteɪtəʊ/", syl: "po-ta-to" },
        { w: "tomato", zh: "西红柿", g: 2, c: "食物", ipa: "/təˈmɑːtəʊ/", syl: "to-ma-to" },
        { w: "carrot", zh: "胡萝卜", g: 2, c: "食物", ipa: "/ˈkærət/", syl: "car-rot" },
        { w: "grape", zh: "葡萄", g: 2, c: "食物", ipa: "/ɡreɪp/", syl: "grape" },
        { w: "watermelon", zh: "西瓜", g: 2, c: "食物", ipa: "/ˈwɔːtəmelən/", syl: "wa-ter-mel-on" },
        { w: "strawberry", zh: "草莓", g: 2, c: "食物", ipa: "/ˈstrɔːbəri/", syl: "straw-ber-ry" },
        { w: "lemon", zh: "柠檬", g: 2, c: "食物", ipa: "/ˈlemən/", syl: "lem-on" },

        /* 房间与家 */
        { w: "house", zh: "房子", g: 2, c: "家", ipa: "/haʊs/", syl: "house" },
        { w: "home", zh: "家", g: 2, c: "家", ipa: "/həʊm/", syl: "home" },
        { w: "room", zh: "房间", g: 2, c: "家", ipa: "/ruːm/", syl: "room" },
        { w: "bedroom", zh: "卧室", g: 2, c: "家", ipa: "/ˈbedruːm/", syl: "bed-room" },
        { w: "kitchen", zh: "厨房", g: 2, c: "家", ipa: "/ˈkɪtʃɪn/", syl: "kit-chen" },
        { w: "bed", zh: "床", g: 2, c: "家", ipa: "/bed/", syl: "bed" },
        { w: "table", zh: "桌子", g: 2, c: "家", ipa: "/ˈteɪbl/", syl: "ta-ble" },
        { w: "sofa", zh: "沙发", g: 2, c: "家", ipa: "/ˈsəʊfə/", syl: "so-fa" },
        { w: "window", zh: "窗户", g: 2, c: "家", ipa: "/ˈwɪndəʊ/", syl: "win-dow" },
        { w: "door", zh: "门", g: 2, c: "家", ipa: "/dɔː/", syl: "door" },
        { w: "wall", zh: "墙", g: 2, c: "家", ipa: "/wɔːl/", syl: "wall" },
        { w: "clock", zh: "钟", g: 2, c: "家", ipa: "/klɒk/", syl: "clock" },
        { w: "lamp", zh: "台灯", g: 2, c: "家", ipa: "/læmp/", syl: "lamp" },

        /* 动作 */
        { w: "run", zh: "跑", g: 2, c: "动作", ipa: "/rʌn/", syl: "run" },
        { w: "jump", zh: "跳", g: 2, c: "动作", ipa: "/dʒʌmp/", syl: "jump" },
        { w: "swim", zh: "游泳", g: 2, c: "动作", ipa: "/swɪm/", syl: "swim" },
        { w: "sing", zh: "唱歌", g: 2, c: "动作", ipa: "/sɪŋ/", syl: "sing" },
        { w: "dance", zh: "跳舞", g: 2, c: "动作", ipa: "/dɑːns/", syl: "dance" },
        { w: "read", zh: "读；阅读", g: 2, c: "动作", ipa: "/riːd/", syl: "read" },
        { w: "write", zh: "写", g: 2, c: "动作", ipa: "/raɪt/", syl: "write" },
        { w: "draw", zh: "画画", g: 2, c: "动作", ipa: "/drɔː/", syl: "draw" },
        { w: "play", zh: "玩；踢（球）", g: 2, c: "动作", ipa: "/pleɪ/", syl: "play" },
        { w: "eat", zh: "吃", g: 2, c: "动作", ipa: "/iːt/", syl: "eat" },
        { w: "drink", zh: "喝", g: 2, c: "动作", ipa: "/drɪŋk/", syl: "drink" },
        { w: "sleep", zh: "睡觉", g: 2, c: "动作", ipa: "/sliːp/", syl: "sleep" },
        { w: "walk", zh: "走路", g: 2, c: "动作", ipa: "/wɔːk/", syl: "walk" },
        { w: "fly", zh: "飞", g: 2, c: "动作", ipa: "/flaɪ/", syl: "fly" },
        { w: "climb", zh: "爬", g: 2, c: "动作", ipa: "/klaɪm/", syl: "climb" },
        { w: "ride", zh: "骑", g: 2, c: "动作", ipa: "/raɪd/", syl: "ride" },

        /* 学科 */
        { w: "English", zh: "英语", g: 2, c: "学科", ipa: "/ˈɪŋɡlɪʃ/", syl: "Eng-lish" },
        { w: "Chinese", zh: "语文；中文", g: 2, c: "学科", ipa: "/ˈtʃiːniːz/", syl: "Chi-nese" },
        { w: "math", zh: "数学", g: 2, c: "学科", ipa: "/mæθ/", syl: "math" },
        { w: "music", zh: "音乐", g: 2, c: "学科", ipa: "/ˈmjuːzɪk/", syl: "mu-sic" },
        { w: "art", zh: "美术", g: 2, c: "学科", ipa: "/ɑːt/", syl: "art" },

        /* 场所 */
        { w: "park", zh: "公园", g: 2, c: "场所", ipa: "/pɑːk/", syl: "park" },
        { w: "zoo", zh: "动物园", g: 2, c: "场所", ipa: "/zuː/", syl: "zoo" },
        { w: "shop", zh: "商店", g: 2, c: "场所", ipa: "/ʃɒp/", syl: "shop" },
        { w: "library", zh: "图书馆", g: 2, c: "场所", ipa: "/ˈlaɪbrəri/", syl: "li-brar-y" },
        { w: "garden", zh: "花园", g: 2, c: "场所", ipa: "/ˈɡɑːdn/", syl: "gar-den" },
        { w: "farm", zh: "农场", g: 2, c: "场所", ipa: "/fɑːm/", syl: "farm" },
        { w: "street", zh: "街道", g: 2, c: "场所", ipa: "/striːt/", syl: "street" },

        /* 代词 */
        { w: "he", zh: "他", g: 2, c: "代词", ipa: "/hiː/", syl: "he" },
        { w: "she", zh: "她", g: 2, c: "代词", ipa: "/ʃiː/", syl: "she" },
        { w: "it", zh: "它", g: 2, c: "代词", ipa: "/ɪt/", syl: "it" },
        { w: "we", zh: "我们", g: 2, c: "代词", ipa: "/wiː/", syl: "we" },
        { w: "they", zh: "他们", g: 2, c: "代词", ipa: "/ðeɪ/", syl: "they" },
        { w: "my", zh: "我的", g: 2, c: "代词", ipa: "/maɪ/", syl: "my" },
        { w: "your", zh: "你的", g: 2, c: "代词", ipa: "/jɔː/", syl: "your" },
        { w: "his", zh: "他的", g: 2, c: "代词", ipa: "/hɪz/", syl: "his" },
        { w: "her", zh: "她的", g: 2, c: "代词", ipa: "/hɜː/", syl: "her" },
        { w: "our", zh: "我们的", g: 2, c: "代词", ipa: "/aʊə/", syl: "our" },

        /* 疑问词 */
        { w: "what", zh: "什么", g: 2, c: "疑问词", ipa: "/wɒt/", syl: "what" },
        { w: "who", zh: "谁", g: 2, c: "疑问词", ipa: "/huː/", syl: "who" },
        { w: "where", zh: "在哪里", g: 2, c: "疑问词", ipa: "/weə/", syl: "where" },
        { w: "how", zh: "怎样；多少", g: 2, c: "疑问词", ipa: "/haʊ/", syl: "how" },

        /* 介词 */
        { w: "in", zh: "在……里面", g: 2, c: "介词", ipa: "/ɪn/", syl: "in" },
        { w: "on", zh: "在……上面", g: 2, c: "介词", ipa: "/ɒn/", syl: "on" },
        { w: "under", zh: "在……下面", g: 2, c: "介词", ipa: "/ˈʌndə/", syl: "un-der" },
        { w: "near", zh: "在……附近", g: 2, c: "介词", ipa: "/nɪə/", syl: "near" },
        { w: "behind", zh: "在……后面", g: 2, c: "介词", ipa: "/bɪˈhaɪnd/", syl: "be-hind" },

        /* ---------------- 三年级 ---------------- */
        /* 职业 */
        { w: "doctor", zh: "医生", g: 3, c: "职业", ipa: "/ˈdɒktə/", syl: "doc-tor" },
        { w: "nurse", zh: "护士", g: 3, c: "职业", ipa: "/nɜːs/", syl: "nurse" },
        { w: "farmer", zh: "农民", g: 3, c: "职业", ipa: "/ˈfɑːmə/", syl: "farm-er" },
        { w: "driver", zh: "司机", g: 3, c: "职业", ipa: "/ˈdraɪvə/", syl: "driv-er" },
        { w: "policeman", zh: "警察", g: 3, c: "职业", ipa: "/pəˈlɪsmən/", syl: "po-lice-man" },
        { w: "worker", zh: "工人", g: 3, c: "职业", ipa: "/ˈwɜːkə/", syl: "work-er" },
        { w: "singer", zh: "歌手", g: 3, c: "职业", ipa: "/ˈsɪŋə/", syl: "sing-er" },
        { w: "writer", zh: "作家", g: 3, c: "职业", ipa: "/ˈraɪtə/", syl: "writ-er" },
        { w: "artist", zh: "画家", g: 3, c: "职业", ipa: "/ˈɑːtɪst/", syl: "art-ist" },
        { w: "cook", zh: "厨师", g: 3, c: "职业", ipa: "/kʊk/", syl: "cook" },

        /* 交通 */
        { w: "bus", zh: "公共汽车", g: 3, c: "交通", ipa: "/bʌs/", syl: "bus" },
        { w: "bike", zh: "自行车", g: 3, c: "交通", ipa: "/baɪk/", syl: "bike" },
        { w: "train", zh: "火车", g: 3, c: "交通", ipa: "/treɪn/", syl: "train" },
        { w: "plane", zh: "飞机", g: 3, c: "交通", ipa: "/pleɪn/", syl: "plane" },
        { w: "ship", zh: "轮船", g: 3, c: "交通", ipa: "/ʃɪp/", syl: "ship" },
        { w: "taxi", zh: "出租车", g: 3, c: "交通", ipa: "/ˈtæksi/", syl: "taxi" },
        { w: "subway", zh: "地铁", g: 3, c: "交通", ipa: "/ˈsʌbweɪ/", syl: "sub-way" },
        { w: "boat", zh: "小船", g: 3, c: "交通", ipa: "/bəʊt/", syl: "boat" },

        /* 季节与月份 */
        { w: "spring", zh: "春天", g: 3, c: "季节", ipa: "/sprɪŋ/", syl: "spring" },
        { w: "summer", zh: "夏天", g: 3, c: "季节", ipa: "/ˈsʌmə/", syl: "sum-mer" },
        { w: "autumn", zh: "秋天", g: 3, c: "季节", ipa: "/ˈɔːtəm/", syl: "au-tumn" },
        { w: "winter", zh: "冬天", g: 3, c: "季节", ipa: "/ˈwɪntə/", syl: "win-ter" },
        { w: "January", zh: "一月", g: 3, c: "月份", ipa: "/ˈdʒænjuəri/", syl: "Jan-u-ar-y" },
        { w: "February", zh: "二月", g: 3, c: "月份", ipa: "/ˈfebruəri/", syl: "Feb-ru-ar-y" },
        { w: "March", zh: "三月", g: 3, c: "月份", ipa: "/mɑːtʃ/", syl: "March" },
        { w: "April", zh: "四月", g: 3, c: "月份", ipa: "/ˈeɪprɪl/", syl: "Ap-ril" },
        { w: "May", zh: "五月", g: 3, c: "月份", ipa: "/meɪ/", syl: "May" },
        { w: "June", zh: "六月", g: 3, c: "月份", ipa: "/dʒuːn/", syl: "June" },
        { w: "July", zh: "七月", g: 3, c: "月份", ipa: "/ˈdʒuːlaɪ/", syl: "Ju-ly" },
        { w: "August", zh: "八月", g: 3, c: "月份", ipa: "/ˈɔːɡəst/", syl: "Au-gust" },
        { w: "September", zh: "九月", g: 3, c: "月份", ipa: "/sepˈtembə/", syl: "Sep-tem-ber" },
        { w: "October", zh: "十月", g: 3, c: "月份", ipa: "/ɒkˈtəʊbə/", syl: "Oc-to-ber" },
        { w: "November", zh: "十一月", g: 3, c: "月份", ipa: "/nəˈvembə/", syl: "No-vem-ber" },
        { w: "December", zh: "十二月", g: 3, c: "月份", ipa: "/dɪˈsembə/", syl: "De-cem-ber" },

        /* 自然 */
        { w: "sun", zh: "太阳", g: 3, c: "自然", ipa: "/sʌn/", syl: "sun" },
        { w: "moon", zh: "月亮", g: 3, c: "自然", ipa: "/muːn/", syl: "moon" },
        { w: "star", zh: "星星", g: 3, c: "自然", ipa: "/stɑː/", syl: "star" },
        { w: "sky", zh: "天空", g: 3, c: "自然", ipa: "/skaɪ/", syl: "sky" },
        { w: "tree", zh: "树", g: 3, c: "自然", ipa: "/triː/", syl: "tree" },
        { w: "flower", zh: "花", g: 3, c: "自然", ipa: "/ˈflaʊə/", syl: "flow-er" },
        { w: "grass", zh: "草", g: 3, c: "自然", ipa: "/ɡrɑːs/", syl: "grass" },
        { w: "river", zh: "河流", g: 3, c: "自然", ipa: "/ˈrɪvə/", syl: "riv-er" },
        { w: "mountain", zh: "山", g: 3, c: "自然", ipa: "/ˈmaʊntən/", syl: "moun-tain" },
        { w: "sea", zh: "大海", g: 3, c: "自然", ipa: "/siː/", syl: "sea" },
        { w: "lake", zh: "湖", g: 3, c: "自然", ipa: "/leɪk/", syl: "lake" },
        { w: "forest", zh: "森林", g: 3, c: "自然", ipa: "/ˈfɒrɪst/", syl: "for-est" },
        { w: "cloud", zh: "云", g: 3, c: "自然", ipa: "/klaʊd/", syl: "cloud" },
        { w: "rain", zh: "雨", g: 3, c: "自然", ipa: "/reɪn/", syl: "rain" },
        { w: "snow", zh: "雪", g: 3, c: "自然", ipa: "/snəʊ/", syl: "snow" },
        { w: "wind", zh: "风", g: 3, c: "自然", ipa: "/wɪnd/", syl: "wind" },

        /* 描述 */
        { w: "beautiful", zh: "美丽的", g: 3, c: "形容词", ipa: "/ˈbjuːtɪfl/", syl: "beau-ti-ful" },
        { w: "clever", zh: "聪明的", g: 3, c: "形容词", ipa: "/ˈklevə/", syl: "clev-er" },
        { w: "funny", zh: "有趣的；滑稽的", g: 3, c: "形容词", ipa: "/ˈfʌni/", syl: "fun-ny" },
        { w: "quiet", zh: "安静的", g: 3, c: "形容词", ipa: "/ˈkwaɪət/", syl: "qui-et" },
        { w: "strong", zh: "强壮的", g: 3, c: "形容词", ipa: "/strɒŋ/", syl: "strong" },
        { w: "young", zh: "年轻的", g: 3, c: "形容词", ipa: "/jʌŋ/", syl: "young" },
        { w: "kind", zh: "善良的", g: 3, c: "形容词", ipa: "/kaɪnd/", syl: "kind" },
        { w: "friendly", zh: "友好的", g: 3, c: "形容词", ipa: "/ˈfrendli/", syl: "friend-ly" },
        { w: "careful", zh: "小心的", g: 3, c: "形容词", ipa: "/ˈkeəfl/", syl: "care-ful" },
        { w: "healthy", zh: "健康的", g: 3, c: "形容词", ipa: "/ˈhelθi/", syl: "health-y" },

        /* 日常生活 */
        { w: "breakfast", zh: "早餐", g: 3, c: "生活", ipa: "/ˈbrekfəst/", syl: "break-fast" },
        { w: "lunch", zh: "午餐", g: 3, c: "生活", ipa: "/lʌntʃ/", syl: "lunch" },
        { w: "dinner", zh: "晚餐", g: 3, c: "生活", ipa: "/ˈdɪnə/", syl: "din-ner" },
        { w: "homework", zh: "作业", g: 3, c: "生活", ipa: "/ˈhəʊmwɜːk/", syl: "home-work" },
        { w: "holiday", zh: "假期", g: 3, c: "生活", ipa: "/ˈhɒlideɪ/", syl: "hol-i-day" },
        { w: "weekend", zh: "周末", g: 3, c: "生活", ipa: "/ˈwiːkend/", syl: "week-end" },
        { w: "birthday", zh: "生日", g: 3, c: "生活", ipa: "/ˈbɜːθdeɪ/", syl: "birth-day" },
        { w: "Christmas", zh: "圣诞节", g: 3, c: "生活", ipa: "/ˈkrɪsməs/", syl: "Christ-mas" },
        { w: "party", zh: "聚会", g: 3, c: "生活", ipa: "/ˈpɑːti/", syl: "par-ty" },
        { w: "gift", zh: "礼物", g: 3, c: "生活", ipa: "/ɡɪft/", syl: "gift" },

        /* 动词 */
        { w: "help", zh: "帮助", g: 3, c: "动作", ipa: "/help/", syl: "help" },
        { w: "open", zh: "打开", g: 3, c: "动作", ipa: "/ˈəʊpən/", syl: "o-pen" },
        { w: "close", zh: "关闭", g: 3, c: "动作", ipa: "/kləʊz/", syl: "close" },
        { w: "look", zh: "看", g: 3, c: "动作", ipa: "/lʊk/", syl: "look" },
        { w: "listen", zh: "听", g: 3, c: "动作", ipa: "/ˈlɪsn/", syl: "lis-ten" },
        { w: "speak", zh: "说；讲", g: 3, c: "动作", ipa: "/spiːk/", syl: "speak" },
        { w: "talk", zh: "交谈", g: 3, c: "动作", ipa: "/tɔːk/", syl: "talk" },
        { w: "love", zh: "爱", g: 3, c: "动作", ipa: "/lʌv/", syl: "love" },
        { w: "like", zh: "喜欢", g: 3, c: "动作", ipa: "/laɪk/", syl: "like" },
        { w: "want", zh: "想要", g: 3, c: "动作", ipa: "/wɔːnt/", syl: "want" },
        { w: "have", zh: "有", g: 3, c: "动作", ipa: "/hæv/", syl: "have" },
        { w: "go", zh: "去", g: 3, c: "动作", ipa: "/ɡəʊ/", syl: "go" },
        { w: "come", zh: "来", g: 3, c: "动作", ipa: "/kʌm/", syl: "come" },
        { w: "get", zh: "得到", g: 3, c: "动作", ipa: "/ɡet/", syl: "get" },
        { w: "put", zh: "放", g: 3, c: "动作", ipa: "/pʊt/", syl: "put" },
        { w: "take", zh: "拿；带走", g: 3, c: "动作", ipa: "/teɪk/", syl: "take" },
        { w: "find", zh: "找到", g: 3, c: "动作", ipa: "/faɪnd/", syl: "find" },
        { w: "give", zh: "给", g: 3, c: "动作", ipa: "/ɡɪv/", syl: "give" },
        { w: "buy", zh: "买", g: 3, c: "动作", ipa: "/baɪ/", syl: "buy" },

        /* 物品与概念 */
        { w: "computer", zh: "电脑", g: 3, c: "物品", ipa: "/kəmˈpjuːtə/", syl: "com-put-er" },
        { w: "phone", zh: "电话；手机", g: 3, c: "物品", ipa: "/fəʊn/", syl: "phone" },
        { w: "picture", zh: "图画；照片", g: 3, c: "物品", ipa: "/ˈpɪktʃə/", syl: "pic-ture" },
        { w: "story", zh: "故事", g: 3, c: "物品", ipa: "/ˈstɔːri/", syl: "sto-ry" },
        { w: "game", zh: "游戏", g: 3, c: "物品", ipa: "/ɡeɪm/", syl: "game" },
        { w: "money", zh: "钱", g: 3, c: "物品", ipa: "/ˈmʌni/", syl: "mon-ey" },
        { w: "time", zh: "时间", g: 3, c: "概念", ipa: "/taɪm/", syl: "time" },
        { w: "year", zh: "年", g: 3, c: "概念", ipa: "/jɪə/", syl: "year" },
        { w: "month", zh: "月", g: 3, c: "概念", ipa: "/mʌnθ/", syl: "month" },
        { w: "hour", zh: "小时", g: 3, c: "概念", ipa: "/ˈaʊə/", syl: "hour" },
        { w: "minute", zh: "分钟", g: 3, c: "概念", ipa: "/ˈmɪnɪt/", syl: "min-ute" },
        { w: "question", zh: "问题", g: 3, c: "概念", ipa: "/ˈkwestʃən/", syl: "ques-tion" },
        { w: "answer", zh: "答案", g: 3, c: "概念", ipa: "/ˈɑːnsə/", syl: "an-swer" },
        { w: "word", zh: "单词", g: 3, c: "概念", ipa: "/wɜːd/", syl: "word" },
        { w: "letter", zh: "字母；信", g: 3, c: "概念", ipa: "/ˈletə/", syl: "let-ter" },
        { w: "number", zh: "数字；号码", g: 3, c: "概念", ipa: "/ˈnʌmbə/", syl: "num-ber" },

        /* 情绪 */
        { w: "angry", zh: "生气的", g: 3, c: "情绪", ipa: "/ˈæŋɡri/", syl: "an-gry" },
        { w: "tired", zh: "疲倦的", g: 3, c: "情绪", ipa: "/ˈtaɪəd/", syl: "tir-ed" },
        { w: "hungry", zh: "饥饿的", g: 3, c: "情绪", ipa: "/ˈhʌŋɡri/", syl: "hun-gry" },
        { w: "thirsty", zh: "口渴的", g: 3, c: "情绪", ipa: "/ˈθɜːsti/", syl: "thirs-ty" },
        { w: "excited", zh: "兴奋的", g: 3, c: "情绪", ipa: "/ɪkˈsaɪtɪd/", syl: "ex-cit-ed" },
        { w: "afraid", zh: "害怕的", g: 3, c: "情绪", ipa: "/əˈfreɪd/", syl: "a-fraid" }
    ];

    var GRADE_TEXT = { 1: "一年级", 2: "二年级", 3: "三年级" };
    var VOWELS = "aeiou";

    /* ---------- 工具 ---------- */

    function norm(word) {
        return String(word).toLowerCase().replace(/[^a-z]/g, "");
    }

    function gradeText(g) {
        return GRADE_TEXT[g] || String(g) + "年级";
    }

    /* 音标 + 音节（单音节词不再重复一遍单词） */
    function phonText(it) {
        var syl = String(it.syl || "").trim();
        if (!syl || syl.toLowerCase() === String(it.w).toLowerCase()) return it.ipa;
        return it.ipa + " · " + syl;
    }

    function filter(opts) {
        opts = opts || {};
        var grades = opts.grades;
        var cats = opts.categories;
        return words.filter(function (it) {
            if (grades && grades.length && grades.indexOf(it.g) < 0) return false;
            if (cats && cats.length && cats.indexOf(it.c) < 0) return false;
            return true;
        });
    }

    function count(grades) {
        return filter({ grades: grades }).length;
    }

    function pick(list, random) {
        return list[Math.floor(random() * list.length)];
    }

    /* 自然拼读提示：按字母组合给出规则，词库只存音标与音节 */
    /* 按拼写 + 音标给出拼读提示：只有音标能证实的规则才说，避免误导 */
    function phonicsHint(word, ipa) {
        var w = norm(word);
        var p = String(ipa || "").replace(/[\/\s]/g, "");
        if (!w) return "";
        if (!p) return "按音节一块一块地拼，再连起来读";

        var tips = [];
        function has(x) { return p.indexOf(x) >= 0; }
        function add(t) { if (tips.indexOf(t) < 0) tips.push(t); }

        if (/sh/.test(w) && has("ʃ")) add("sh 读 /ʃ/");
        if (/ch/.test(w)) {
            if (has("tʃ")) add("ch 读 /tʃ/");
            else if (has("k")) add("ch 读 /k/");
        }
        if (/th/.test(w)) {
            if (has("θ")) add("th 读 /θ/");
            else if (has("ð")) add("th 读 /ð/");
        }
        if (/ph/.test(w) && has("f")) add("ph 读 /f/");
        if (/wh/.test(w) && has("w")) add("wh 读 /w/");
        if (/ck/.test(w) && has("k")) add("ck 读 /k/");
        if (/ng/.test(w) && has("ŋ")) add("ng 读 /ŋ/");

        if (/oo/.test(w)) {
            if (has("ɔː")) add("oo 读 /ɔː/");
            else if (has("uː")) add("oo 读 /uː/");
            else if (has("ʊ")) add("oo 读 /ʊ/");
        }
        if (/ee/.test(w) && has("iː")) add("ee 读 /iː/");
        if (/ea/.test(w)) {
            if (has("ɪə")) add("ea 读 /ɪə/");
            else if (has("eə")) add("ea 读 /eə/");
            else if (has("iː")) add("ea 读 /iː/");
            else if (has("e")) add("ea 读 /e/");
        }
        if (/ai|ay/.test(w) && has("eɪ")) add("ai / ay 读 /eɪ/");
        if (/oa/.test(w) && has("əʊ")) add("oa 读 /əʊ/");
        else if (/ow/.test(w)) {
            if (has("aʊ")) add("ow 读 /aʊ/");
            else if (has("əʊ")) add("ow 读 /əʊ/");
        }
        if (/ou/.test(w)) {
            if (has("aʊ")) add("ou 读 /aʊ/");
            else if (has("uː")) add("ou 读 /uː/");
            else if (has("ʌ")) add("ou 读 /ʌ/");
            else if (has("ɔː")) add("ou 读 /ɔː/");
        }
        if (/ar/.test(w)) {
            if (has("ɔː")) add("ar 读 /ɔː/");
            else if (has("ɑː")) add("ar 读 /ɑː/");
        }
        if (/or/.test(w) && !/oor/.test(w)) {
            if (has("ɜː")) add("or 读 /ɜː/");
            else if (has("ɔː")) add("or 读 /ɔː/");
            else if (has("ɒ")) add("or 读 /ɒ/");
            else if (has("ə")) add("or 读 /ə/");
        }
        if (/ir/.test(w) && has("ɜː")) add("ir 读 /ɜː/");
        if (/ur/.test(w) && !/our/.test(w) && has("ɜː")) add("ur 读 /ɜː/");
        if (/er$/.test(w) && !/eer$/.test(w) && has("ə")) add("词尾 -er 读 /ə/");
        if (/[^aeiou]le$/.test(w) && /l$/.test(p)) add("词尾 -le 读 /l/");
        if (/[^aeiou]e$/.test(w) && w.length > 3 && !/ee$|ie$|ue$/.test(w) &&
            /[^aeiouːəɪʊæɒʌɜ]$/.test(p)) {
            add("词尾 e 不发音");
        }
        if (w.length > 3 && /([bdgklmnprst])\1/.test(w)) add("双写辅音只读一次");

        if (!tips.length) add("按音节一块一块地拼，再连起来读");
        return tips.slice(0, 3).join("；");
    }

    /* ---------- 干扰项 ---------- */

    function similarWords(target, pool, random, numberOf) {
        var sameCat = pool.filter(function (it) {
            return it !== target && it.c === target.c;
        });
        var rest = pool.filter(function (it) {
            return it !== target && it.c !== target.c;
        });
        // 同主题优先，其次挑长度接近的词
        rest.sort(function (a, b) {
            return Math.abs(a.w.length - target.w.length) - Math.abs(b.w.length - target.w.length);
        });

        var picked = [];
        var seen = {};
        seen[target.w] = true;

        function take(from) {
            var i = Math.floor(random() * from.length);
            var cand = from[i];
            if (!cand || seen[cand.w]) return false;
            seen[cand.w] = true;
            picked.push(cand);
            return true;
        }

        var guard = 0;
        while (picked.length < numberOf && guard < 200) {
            guard++;
            if (sameCat.length && random() < 0.7) {
                if (take(sameCat)) continue;
            }
            // 剩余从短的候选里随机抽前一半，保证长度相近
            var window = rest.slice(0, Math.max(numberOf + 3, 6));
            if (!take(window)) take(rest);
        }
        return picked;
    }

    /* 把单词对半切开：前半段给出，后半段作为答案 */
    function splitWord(word) {
        var n = word.length;
        var cut = n >= 6 ? Math.ceil(n / 2) : n >= 4 ? Math.floor(n / 2) : 1;
        cut = Math.min(cut, n - 1);
        return { head: word.slice(0, cut), tail: word.slice(cut) };
    }

    function mutateTail(tail, random, count) {
        var out = [];
        var seen = {};
        seen[tail] = true;
        var vowels = "aeiou";
        var guard = 0;

        while (out.length < count && guard < 80) {
            guard++;
            var cand = tail;
            var mode = Math.floor(random() * 4);
            if (mode === 0) {
                // 换一个元音
                var idx = -1;
                for (var i = 0; i < cand.length; i++) {
                    if (vowels.indexOf(cand[i]) >= 0) { idx = i; break; }
                }
                if (idx < 0) continue;
                var v = vowels[Math.floor(random() * vowels.length)];
                cand = cand.slice(0, idx) + v + cand.slice(idx + 1);
            } else if (mode === 1) {
                // 换最后一个字母
                var letters = "abcdefghijklmnopqrstuvwxyz";
                var l = letters[Math.floor(random() * letters.length)];
                cand = cand.slice(0, -1) + l;
            } else if (mode === 2) {
                // 换第一个字母
                var l2 = "abcdefghijklmnopqrstuvwxyz".charAt(Math.floor(random() * 26));
                cand = l2 + cand.slice(1);
            } else {
                // 去掉一个字母或重复一个字母
                if (cand.length > 1) {
                    var p = Math.floor(random() * cand.length);
                    cand = cand.slice(0, p) + cand.slice(p + 1);
                } else {
                    cand = cand + cand;
                }
            }
            if (cand && cand !== tail && !seen[cand]) {
                seen[cand] = true;
                out.push(cand);
            }
        }
        return out;
    }

    /* 生成 4 个互不重复的选项：同主题优先，中文释义重复（如 bye / goodbye）只留一个 */
    function buildOptions(target, pool, random, field) {
        var opts = [{ text: target[field], right: true }];
        var seen = {};
        seen[target[field]] = true;

        var cands = similarWords(target, pool, random, 8);
        for (var i = 0; i < cands.length && opts.length < 4; i++) {
            var text = cands[i][field];
            if (seen[text]) continue;
            seen[text] = true;
            opts.push({ text: text, right: false });
        }
        // 极端情况下（同义重复太多）再从全库补
        var all = pool.filter(function (it) { return it !== target; });
        for (var j = 0; j < all.length && opts.length < 4; j++) {
            var t2 = all[j][field];
            if (seen[t2]) continue;
            seen[t2] = true;
            opts.push({ text: t2, right: false });
        }
        return opts;
    }

    function shuffle(list, random) {
        var arr = list.slice();
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(random() * (i + 1));
            var t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
        return arr;
    }

    /* ---------- 出题 ---------- */

    var TYPE_META = {
        "en2zh": { mode: "choice", ask: "这个单词是什么意思？", label: "英翻中" },
        "zh2en": { mode: "choice", ask: "哪个单词是它的英文？", label: "中翻英" },
        "zh2en-write": { mode: "write", ask: "把英文单词写出来", label: "中翻英 · 手写" },
        "fill-choice": { mode: "choice", ask: "选一选，把单词补完整", label: "补全单词" },
        "fill-write": { mode: "write", ask: "把缺的后半段写出来", label: "补全单词 · 手写" }
    };

    /**
     * 生成一道题
     * opts: { grades, types, exclude, random, level }
     * 返回 null 表示范围内没有可用单词
     */
    function makeQuestion(type, opts) {
        opts = opts || {};
        var random = opts.random || Math.random;
        var pool = filter({ grades: opts.grades });
        var usable = pool.filter(function (it) {
            if (opts.exclude && opts.exclude.indexOf(it.w) >= 0) return false;
            if (type === "fill-choice" || type === "fill-write") {
                return norm(it.w).length >= 4 && /^[a-zA-Z]+$/.test(it.w);
            }
            return true;
        });
        if (!usable.length) return null;

        var target = pick(usable, random);
        var meta = TYPE_META[type] || TYPE_META.en2zh;
        var q = {
            type: type,
            mode: meta.mode,
            label: meta.label,
            ask: meta.ask,
            word: target,
            options: [],
            answer: target.w,
            hint: phonicsHint(target.w, target.ipa),
            gradeText: gradeText(target.g)
        };

        if (type === "en2zh") {
            q.promptMain = target.w;
            q.promptSub = phonText(target);
            q.answer = target.zh;
            q.options = shuffle(buildOptions(target, pool, random, "zh"), random);
            return q;
        }

        if (type === "zh2en") {
            q.promptMain = target.zh;
            q.promptSub = gradeText(target.g) + " · " + target.c;
            q.options = shuffle(buildOptions(target, pool, random, "w"), random);
            return q;
        }

        if (type === "zh2en-write") {
            q.promptMain = target.zh;
            q.promptSub = target.gradeText + " · " + target.syl + " · 共 " + norm(target.w).length + " 个字母";
            q.answer = target.w;
            q.inputHint = target.w.charAt(0) + "…";
            return q;
        }

        var sp = splitWord(norm(target.w));
        if (type === "fill-choice") {
            q.promptMain = sp.head + " ___";
            q.promptSub = target.zh + " · " + target.ipa;
            q.answer = sp.tail;
            q.head = sp.head;
            q.options = shuffle(
                [{ text: sp.tail, right: true }].concat(
                    mutateTail(sp.tail, random, 3).map(function (t) {
                        return { text: t, right: false };
                    })
                ),
                random
            );
            return q;
        }

        // fill-write
        q.promptMain = sp.head + " ___";
        q.promptSub = target.zh + " · " + target.ipa + " · 缺 " + sp.tail.length + " 个字母";
        q.answer = sp.tail;
        q.head = sp.head;
        q.inputHint = sp.tail.charAt(0) + "…";
        return q;
    }

    function isCorrect(q, input) {
        if (!q || input == null) return false;
        return norm(input) === norm(q.answer);
    }

    var api = {
        words: words,
        grades: [1, 2, 3],
        categories: (function () {
            var seen = {};
            var out = [];
            words.forEach(function (it) {
                if (!seen[it.c]) { seen[it.c] = true; out.push(it.c); }
            });
            return out;
        })(),
        gradeText: gradeText,
        filter: filter,
        count: count,
        phonicsHint: phonicsHint,
        phonText: phonText,
        makeQuestion: makeQuestion,
        isCorrect: isCorrect,
        norm: norm,
        splitWord: splitWord,
        typeMeta: TYPE_META,
        pick: pick
    };

    global.EnglishData = api;
})(typeof window !== "undefined" ? window : globalThis);
