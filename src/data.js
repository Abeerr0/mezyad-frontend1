// تم التعديل من عبير: هذي بيانات معاينه فقط وما تنحفظ بقاعده البيانات.
const now = Date.now();
export const demoCategories = [
  { id: "cars", name: "Rare Vehicles", label: "السيارات النادرة" },
  { id: "property", name: "Real Estate", label: "العقارات" },
  { id: "plates", name: "Vehicle Plates", label: "اللوحات المميزة" },
  { id: "camels", name: "Camels", label: "الإبل" },
  { id: "bags", name: "Luxury Handbags", label: "الحقائب الفاخرة" },
];
export const categoryLabels = Object.fromEntries(
  demoCategories.map((c) => [c.name, c.label]),
);
export const demoAuctions = [
  {
    id: "preview-car",
    title: "بورش كاريرا GT — 2005",
    category_id: "cars",
    category_name: "Rare Vehicles",
    visibility: "PUBLIC",
    image_url: "/images/porsche-carrera-gt.jpg",
    current_price: "4200000",
    starting_price: "4000000",
    minimum_increment: "10000",
    bid_count: 12,
    status: "ACTIVE",
    end_time: new Date(now + 9 * 3600000).toISOString(),
    start_time: new Date(now - 3600000).toISOString(),
    description:
      "سيارة نادرة بتصميم كلاسيكي وحضور استثنائي. هذه معلومات توضيحية للمعاينة، وليست إعلان بيع فعليًا.",
  },
  {
    id: "preview-villa",
    title: "فيلا في حي حطين",
    category_id: "property",
    category_name: "Real Estate",
    visibility: "PUBLIC",
    image_url: "/images/hittin-villa.jpg",
    current_price: "14500000",
    starting_price: "14000000",
    minimum_increment: "50000",
    bid_count: 8,
    status: "ACTIVE",
    end_time: new Date(now + 22 * 3600000).toISOString(),
    start_time: new Date(now - 7200000).toISOString(),
    description:
      "مساحات رحبة وتفاصيل معمارية هادئة. نموذج بصري يوضح طريقة عرض أصل عقاري في مزياد.",
  },
  {
    id: "preview-plate",
    title: "لوحة مميزة — ن ج د 1",
    category_id: "plates",
    category_name: "Vehicle Plates",
    visibility: "PUBLIC",
    image_url: "/images/plate-njd1.jpg",
    current_price: "750000",
    starting_price: "750000",
    minimum_increment: "5000",
    bid_count: 0,
    status: "SCHEDULED",
    start_time: new Date(now + 30 * 3600000).toISOString(),
    end_time: new Date(now + 54 * 3600000).toISOString(),
    description: "لوحة ذات حروف مميزة ورقم منفرد. مثال معاينة غير معروض للبيع.",
  },
  {
    id: "preview-camel",
    title: "ناقة من سلالة أصيلة",
    category_id: "camels",
    category_name: "Camels",
    visibility: "PUBLIC",
    image_url: "/images/category-camels-hero.png",
    current_price: "180000",
    starting_price: "180000",
    minimum_increment: "1000",
    bid_count: 0,
    status: "CLOSED",
    start_time: new Date(now - 48 * 3600000).toISOString(),
    end_time: new Date(now - 3600000).toISOString(),
    description:
      "مثال توضيحي لبطاقة مزاد إبل منتهٍ. لا تمثل البيانات أصلًا معروضًا للبيع.",
  },
];

// تم التعديل من عبير: نخلي اجابات المساعده مطابقه لفلو المشروع وحدوده.
export const faqItems = [
  {
    group: "general",
    question: "وش الفرق بين الإعلان والمزاد؟",
    answer:
      "الإعلان يجمع معلومات الأصل وصوره ويرسَل للمراجعة. بعد اعتماده، ينشئ صاحبه المزاد ويحدد سعر البداية والزيادة والمواعيد ونوع الدخول.",
    action: "guide",
  },
  {
    group: "general",
    question: "أحتاج حساب عشان أتصفح؟",
    answer:
      "تقدر تتصفح المزادات العامة بدون حساب. البيع والدخول للمزادات الخاصة وتقديم العروض تحتاج تسجيل دخول.",
  },
  {
    group: "seller",
    question: "أقدر أبيع وأزايد بنفس الحساب؟",
    answer:
      "نعم، الحساب نفسه يتيح لك عرض أصولك والمزايدة على أصول الآخرين. ما تقدر تزايد على مزادك.",
  },
  {
    group: "seller",
    question: "وش يصير بعد إرسال إعلاني؟",
    answer:
      "يظهر قيد المراجعة. إذا اعتُمد، تقدر تنشئ مزادًا. وإذا رُفض، يظهر لك السبب لتعدله وتعيد إرساله.",
  },
  {
    group: "seller",
    question: "اعتماد الإعلان ينشر المزاد مباشرة؟",
    answer:
      "لا. بعد الاعتماد تحدد نوع المزاد والأسعار ووقت البداية والنهاية، ثم تنشئه بخطوة مستقلة.",
  },
  {
    group: "seller",
    question: "وش الصور المسموحة؟",
    answer:
      "صور JPG أو PNG أو WebP، بحد أقصى 6 صور و5 MiB للصورة. استخدم صورًا واضحة للأصل نفسه.",
  },
  {
    group: "bidder",
    question: "كيف أعرف أقل مبلغ أقدر أزايد فيه؟",
    answer:
      "أول عرض يبدأ من سعر البداية. بعد وجود عرض مقبول، يكون الحد الأدنى السعر الحالي مضافًا له أقل زيادة. القرار النهائي لقبول العرض عند السيرفر.",
  },
  {
    group: "bidder",
    question: "ليش انرفض عرضي رغم أني شفت سعر أقل؟",
    answer:
      "ممكن انقبل عرض آخر قبل طلبك، أو انتهى الوقت، أو ما اكتملت شروط المشاركة. راجع السعر الجديد ورسالة الرفض قبل إعادة التأكيد.",
  },
  {
    group: "private",
    question: "كيف أدخل مزاد خاص؟",
    answer:
      "سجل دخولك ثم أدخل رمز الوصول اللي شاركه معك البائع. بعد التحقق، يفتح لك المزاد المسموح لحسابك.",
  },
  {
    group: "private",
    question: "مزادي الخاص يظهر للجميع؟",
    answer:
      "لا يظهر ضمن قائمة المزادات العامة. تفاصيله تتاح للمالك والمشرف وللمستخدمين المصرح لهم بعد التحقق من الرمز.",
  },
  {
    group: "bank",
    question: "هل فيه دفع أو تحويل فلوس حقيقي؟",
    answer:
      "لا. Mezyad مشروع MVP، والتكامل البنكي المستهدف في بيئة Sandbox. الالتزام خطوة تحقق للمشاركة، وليس دفعًا أو تسوية مالية.",
  },
  {
    group: "bank",
    question: "إذا التحقق البنكي غير متاح، وش أسوي؟",
    answer:
      "ما نعتبر الالتزام ناجحًا. تظهر حالة عدم توفر الخدمة بدل نجاح وهمي. الربط الرسمي ما زال بانتظار التفعيل؛ اكتمال تجربة المزايدة يتطلب التحقق منه.",
  },
  {
    group: "bidder",
    question: "إذا انتهى المزاد بدون عروض؟",
    answer:
      "تظهر نتيجة بدون فائز. إذا فيه عروض مقبولة، يحدد السيرفر النتيجة ويحفظها. ما فيه دفع أو شحن ضمن هذا النطاق.",
  },
];

export const guideSteps = {
  bidder: [
    {
      title: "اختر أصلًا يهمك",
      text: "تصفح المزادات العامة حسب الفئة والحالة، واقرأ الصور والمواصفات قبل المشاركة.",
      icon: "search",
    },
    {
      title: "جهّز مشاركتك",
      text: "سجل دخولك. للمزاد الخاص استخدم رمز الوصول، ثم أكمل الالتزام عبر الربط الرسمي عند توفره.",
      icon: "shield",
    },
    {
      title: "راجع المبلغ وأكّده",
      text: "راجع أقل عرض مقبول وأكّد المبلغ. كل عرض يفحصه السيرفر حسب الوقت والسعر والصلاحيات.",
      icon: "gavel",
    },
    {
      title: "تابع النتيجة",
      text: "بعد انتهاء المزاد، اطلع على النتيجة المعتمدة. قبول عرضك أثناء المزاد ما يعني فوزك النهائي.",
      icon: "flag",
    },
  ],
  seller: [
    {
      title: "قدّم أصلك بوضوح",
      text: "اختر التصنيف وأضف عنوانًا وصورًا ومواصفات دقيقة للأصل.",
      icon: "image",
    },
    {
      title: "أرسله للمراجعة",
      text: "تابع حالة الإعلان. إذا رُفض، اقرأ السبب وعدّله وأعد إرساله.",
      icon: "shield",
    },
    {
      title: "اختر شروط المزاد",
      text: "بعد الاعتماد، حدد عامًا أو خاصًا، ثم سعر البداية والزيادة وموعدي البداية والنهاية. احفظ رمز الخاص.",
      icon: "gavel",
    },
    {
      title: "تابع مزادك",
      text: "راقب العروض المقبولة والنتيجة النهائية من حسابك، بدون المزايدة على أصلك.",
      icon: "flag",
    },
  ],
};
