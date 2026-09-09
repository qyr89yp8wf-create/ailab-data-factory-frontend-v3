const field = (id, name, type, unit, minimum, maximum, overall, event, relation, enumValues = []) => ({
  field_id:id, label:name, type, unit, enum_values:enumValues, nullable:false, enabled:true,
  value_schema:enumValues.length?{type,enum:enumValues}:{type,minimum,maximum},
  overall_change_rules:overall, stage_event_rules:event, relations_special_constraints:relation,
  quality_mode:'function', quality_python:'def validate(value, context):\n    return value is not None', quality_prompt:'',
});

export const COLDCHAIN_MODEL_FIELDS = [
  field('temperature_setpoint','温度设定值','number','℃',4,4,'本示例每条样本取4℃，整段保持不变。','任何已配置事件均不修改设定值。','不能因为测量值升高而同步抬高设定值；不叠加测量噪声。'),
  field('ambient_temperature','箱外环境温度','number','℃',24,26,'初值在24～26℃内由第一阶段选定，正常在24～26℃内缓慢波动，相邻15分钟变化不超过0.2℃；其他采样间隔按每小时0.8℃限制变化率。','箱内开门、断电及传感器偏移不直接改变环境温度。','作为箱内升温的外部参考；本示例环境始终高于冷藏温度。保留两位小数，无缺失。'),
  field('supply_air_temperature','送风温度','number','℃',0,12,'正常供电制冷时在1.5～3℃小幅波动，初值由第一阶段在正常范围内选定；正常变化率不超过每小时2℃。','断电时送风测点向当前箱温靠近，不能保持主动制冷造成的固定低温；复电后逐渐返回正常范围。制冷能力下降时按事件选定的增量上升。其他热事件可在正常范围内响应；气流受阻不自动提高送风基线。','正常主动制冷时通常低于箱温；断电时允许接近，不强制全程保持固定温差。正常变化率仅约束正常区间，事件区间仍须连续，最大每小时8℃；保留两位小数。'),
  field('return_air_temperature','真实箱温（回风）','number','℃',0,15,'无事件时围绕4℃波动，取值3.5～4.5℃，初值由第一阶段在正常范围内选定；正常变化率不超过每小时1℃。','按第一阶段冻结的升温幅度、滞后和恢复窗口生成。开门、断电、制冷能力下降、气流受阻期间逐步偏离基线，结束后恢复。初始热负载使用冻结的较高初值并逐渐降温。传感器偏移和船期延误不直接改变真实箱温。','这是合成真实状态，不叠加传感器偏差或通信缺失。热事件响应不得瞬间跃升至峰值，也不得在结束时瞬间恢复；事件期最大变化率为每小时8℃，幅度与持续时间无法兼容时返回冲突。保留两位小数。'),
  field('cargo_temperature','货物温度','number','℃',0,15,'普通初值由第一阶段在4～5℃内选定，正常在4～5℃范围缓慢变化，正常变化率不超过每小时0.5℃。','热事件按冻结的货物增量和响应滞后生成，峰值通常晚于箱温；允许在事件结束后继续短暂上升。初始热负载从冻结的8～10℃初值逐渐降至4～5℃。传感器偏移和船期延误不直接改变货物温度。','与真实箱温关联，不能跟随带偏移的传感器读数。除初始热负载外，事件期最大变化率每小时2℃；初始热负载允许每小时6℃。空气恢复窗口结束后，货物可继续恢复，但本示例须在观测结束前回到4～5℃。保留两位小数。'),
  field('relative_humidity','箱内相对湿度','number','%RH',30,90,'初值由第一阶段在60～70内选定，正常在60～70之间缓慢波动，正常每小时变化不超过4个百分点。','本示例没有定义事件造成的湿度定量响应，所有事件下仍按正常范围生成，不根据温度事件擅自加入湿度尖峰。','仅作为独立受限的演示观测量，不宣称满足热湿守恒。若以后需要物理耦合，须增加含湿量等条件和相应规则；不可仅凭温度升高就断言相对湿度升高。保留两位小数。'),
  {...field('latitude','纬度','number','度',-90,90,'第一阶段为本条样本生成合成路线节点、阶段时长与移动进度依据，纬度使用冻结route_plan。模板不指定固定坐标。路线距离、阶段时长和移动速度应符合场景；未要求真实地图时只生成合成几何路线，不声称已匹配真实道路或航道。','港口等待保持本条港口坐标；船期延误增加停留并顺延出发，不修改已确定的航行速度或路线。窗口结束时按实际进度截取，不强行抵达终点。','与longitude共享route_plan的节点、路段和进度，按各路段冻结的时间和插值方式联合生成，保留六位小数；不独立随机游走，不叠加定位噪声。若需要真实地图约束且未提供地图依据，应报告缺少依据；仅未填写具体坐标不是冲突。'),semantic_role:'latitude'},
  {...field('longitude','经度','number','度',-180,180,'使用第一阶段为本条样本生成并冻结的route_plan，与latitude使用完全相同的路段和进度。具体经度不在模板中预填。','港口等待含延误期间保持本条港口经度；离港后按冻结的航程和实际出发时刻推进，不为了补偿延误加速。','与latitude成对生成，保留六位小数。路线节点、到离港时刻和移动进度均引用本条冻结事件，第二阶段不得单独改写。'),semantic_role:'longitude'},
  field('power_status','供电状态','integer','',undefined,undefined,'初值1；正常为1，表示制冷设备有电。','仅在短时断电事件的有效区间内为0；区间结束即恢复1，其余事件均为1。','这是离散设备状态，不加噪声，不因网络状态改变；严格按冻结事件的左闭右开区间赋值。',[0,1]),
  field('transport_stage','运输阶段','string','',undefined,undefined,'依照冻结阶段计划逐点填road、port或sea，同一时刻只属于一个阶段。','船期延误延长port并顺延sea；其它事件不改变运输阶段。','从stage_plan按索引投影，不能每个时间点随机采样；中文显示名由页面映射，数据保持内部ID。',['road','port','sea']),
  field('active_event_type','当前目标事件','string','',undefined,undefined,'未处于主要异常的有效区间时填normal。','主要异常的[start_index,end_index)内填对应事件ID；初始热负载在其降温窗口内填initial_warm_load；船期延误只标额外等待区间。','这是计划注入事件的逐点标记，不是质检结论。事件结束后的恢复期填normal，但曲线可继续恢复；恢复区间保留在事件元数据中。不得把整个异常样本的全部时间点都标为异常。',['normal','door_open','power_off_short','cooling_degradation','sensor_bias','initial_warm_load','blocked_airflow','vessel_delay']),
  field('network_status','联网状态','string','',undefined,undefined,'本示例全程online，不随机注入断网。','制冷设备短时断电不影响独立供电的通信模块；现有八种事件均不切换为offline。','只有用户以后明确新增断网事件及缺失策略时才允许offline。当前模板各字段均不允许null，不以0替代缺失值。',['online','offline']),
  field('return_air_temperature_observed','箱温传感器读数','number','℃',-2,17,'每个时刻以真实箱温为基础，叠加[-0.05,0.05]℃内的小幅测量噪声，初值由第一阶段按本条真实箱温及噪声规则确定，保留两位小数。','传感器偏移区间内，再加本事件冻结的有符号偏移量；偏移结束后的第一个点撤销该偏移。热事件通过真实箱温自然传导到读数，不再重复叠加温升。','读数=真实箱温+有效偏移+测量噪声。偏移开始和结束允许阶跃，真实箱温不得同步阶跃。正常小幅噪声不要求模型实现精确随机分布；不得宣称通过白噪声统计检验。'),
];

const event = (id,name,definition,objects,duration,intensity,conditions,parameters=[]) => ({event_id:id,name,description_definition:definition,impact_targets:objects,duration_range:duration,intensity_parameters:intensity,occurrence_conditions:conditions,parameter_names:parameters});
export const COLDCHAIN_MODEL_EVENTS = [
  event('normal','正常运行','不注入目标异常，按正常阶段和字段基线生成；小幅正常波动不视为异常事件。','制冷设备、箱内空气、货物和监测系统的正常状态。','覆盖整个观测窗口；这是基线，不生成异常区间。','不设置异常强度；使用字段的正常波动范围。','适用于所有阶段；事件类型为正常运行时，events为空数组，主要事件发生阶段不适用。'),
  event('door_open','开门','港口等待期间发生一次开门，温暖外部空气进入，关门后逐步恢复；设定温度保持不变。','箱内空气、送风响应、货物及箱温传感器读数。','开门持续15～45分钟；关门后45～90分钟完成空气温度恢复。','本次箱内空气相对无事件基线的峰值增量取1～3℃；本次货物峰值增量取0.2～0.6℃，货物响应滞后15～30分钟。','仅港口等待阶段；供电正常。事件及空气恢复窗口均在港口阶段内，货物恢复可跨入下一阶段但须在观测窗口内完成，开始前至少保留一个正常采样点。',['air_peak_delta_c','cargo_peak_delta_c','cargo_lag_minutes']),
  event('power_off_short','短时断电','制冷设备暂时失去供电，箱温缓慢回升；恢复供电后逐渐回落。','供电状态、送风温度、箱内空气、货物和箱温读数。','断电持续30～90分钟；复电后60～120分钟恢复空气温度。','本次箱内空气峰值增量取0.5～2℃；货物峰值增量取0.1～0.5℃，响应滞后15～30分钟。','可发生在公路、港口或海运；断电前至少一个正常点；事件与空气恢复窗口均须位于所选阶段，货物恢复可跨阶段但须在观测窗口内完成。通信采用独立电源，本事件不自动导致断网。',['air_peak_delta_c','cargo_peak_delta_c','cargo_lag_minutes']),
  event('cooling_degradation','制冷能力下降','设备有电但制冷效果暂时下降，温度逐步偏离正常基线；能力恢复后逐渐回落。','送风温度、箱内空气、货物。','能力下降持续60～120分钟；结束后60～90分钟恢复空气温度。','本次箱温峰值增量取1～3℃；送风温度峰值增量取0.5～2℃；货物峰值增量取0.2～0.8℃，响应滞后15～30分钟。','可发生在任一阶段，供电保持正常。事件与空气恢复窗口均须位于所选阶段，货物恢复可跨阶段但须在观测窗口内完成，不能另行注入断电。',['air_peak_delta_c','supply_peak_delta_c','cargo_peak_delta_c','cargo_lag_minutes']),
  event('sensor_bias','传感器偏移','箱温传感器读数出现恒定偏移，真实温度仍按正常运行变化；偏移结束后读数恢复。','仅箱温传感器读数return_air_temperature_observed。','偏移持续45～90分钟；结束后的第一个采样点撤销偏移。','偏移方向取正或负，绝对值取0.5～1.5℃；单个事件内偏移值固定。','可发生在任一阶段；至少保留一个偏移前和一个偏移后的点；不能同时改变真实箱温、货物温度或设定值。',['sensor_offset_c']),
  event('initial_warm_load','初始热负载','观测开始时装载的货物温度高于冷藏目标，设备在正常供电下逐步将货物和箱内空气降温。','货物、箱内空气、送风响应。','从第一个采样点开始，降温过程持续60～120分钟。','初始货物温度取8～10℃，初始箱温取5～7℃；过程结束时货物降至4～5℃，箱温回到正常范围。','仅从公路阶段起点开始；不是中途新增热源。降温窗口必须在公路阶段内，不再叠加断电或开门。',['initial_cargo_c','initial_air_c']),
  event('blocked_airflow','气流受阻','箱内循环气流暂时受阻，回风和货物散热受到影响；解除后逐渐恢复。','送风与回风温差、箱内空气、货物。','气流受阻持续60～120分钟；解除后60～90分钟恢复空气温度。','箱温峰值增量取0.5～2℃，货物峰值增量取0.2～0.8℃；货物响应滞后取30～45分钟，送风温度仍在正常范围。','可发生在任一阶段，供电正常；事件与空气恢复窗口均在所选阶段，货物恢复可跨阶段但须在观测窗口内完成。不能通过把送风和回风完全复制成同一曲线来表示。',['air_peak_delta_c','cargo_peak_delta_c','cargo_lag_minutes']),
  event('vessel_delay','船期延误','在计划离港时出现一次额外等待，实际离港时间后移；后续航行速度和计划航程不变。','运输阶段、定位及事件区间；不直接改变热状态。','额外港口等待持续60～120分钟。','强度就是本次额外等待时长，不设置温度增量。','仅港口等待；从原计划离港时刻开始。海运阶段开始时间顺延，观测窗口终点不延长；末尾可能尚未完成航程，不加速追赶。',['delay_minutes']),
];

export const COLDCHAIN_MODEL_DIMENSIONS = [
  {dimension_id:'event_type',name:'事件类型',values:COLDCHAIN_MODEL_EVENTS.map(x=>x.name),option_ids:Object.fromEntries(COLDCHAIN_MODEL_EVENTS.map(x=>[x.name,x.event_id])),description:'本条样本计划表现的一个主要运行事件。正常运行表示不注入目标异常；目标事件不等于生成后的已验证标签。',applicability_conditions:'所有样本；一期每条样本只分配一个主要事件类型。',prohibited_conditions:'正常运行不得同时安排目标异常。不得添加未启用事件；不得通过重复注入其他异常来强化主事件。'},
  {dimension_id:'primary_event_stage',name:'主要事件发生阶段',values:['公路运输','港口等待','海运'],option_ids:{公路运输:'road',港口等待:'port',海运:'sea'},description:'约束主要异常事件的开始阶段，不代表整条样本只包含该阶段。完整运输阶段按第一步场景及本条事件计划安排。',applicability_conditions:'分配了异常事件时适用；正常运行不采样该维度，记录为不适用。',prohibited_conditions:'开门、船期延误只能选择港口等待；初始热负载只能选择公路运输且从第一个时刻开始。其它事件可选择三种阶段。事件及空气恢复是否必须位于该阶段按各事件定义判断；货物能否跨阶段恢复也以对应事件定义为准。'},
  {dimension_id:'cargo_type',name:'货物类型',values:['冷藏货物'],option_ids:{冷藏货物:'chilled_goods'},description:'决定本条样本的货物背景。本示例为非特定品种的冷藏货物，温度范围来自字段规则，不推导食品安全结论。',applicability_conditions:'所有样本。',prohibited_conditions:'不得自行替换为冷冻货物，不得据此编造品种专属保鲜期限或安全阈值。'},
  {dimension_id:'environment',name:'环境条件',values:['常规温暖环境'],option_ids:{常规温暖环境:'mild_warm'},description:'本条样本的外部热环境。本示例以约25℃的温暖环境演示冷藏系统响应。',applicability_conditions:'所有样本。',prohibited_conditions:'不叠加暴雨、极寒、热浪等未配置条件；不得使环境温度因箱内传感器偏移或供电中断而突变。'},
];

export const COLDCHAIN_COMPATIBILITY = {normal:[],door_open:['port'],vessel_delay:['port'],initial_warm_load:['road'],power_off_short:['road','port','sea'],cooling_degradation:['road','port','sea'],sensor_bias:['road','port','sea'],blocked_airflow:['road','port','sea']};

export const COLDCHAIN_MODEL_CONFIGURATION = {
  name:'冷藏集装箱多变量时序示例', business_type:'传感器时序', description:'合成冷藏集装箱运输观测窗口内的温度、湿度、位置和设备状态，用于演示正常运行、热异常、传感器偏移及船期延误。', scope:'custom',
  event_generation:{prompt_version:'timeseries-two-stage/v1',scene_config:{business_scene_description:'模拟冷藏集装箱在公路运输、港口等待和海运过程中的连续监测数据，用于演示多字段时序、异常识别及生成流程验证。正常状态下设备维持冷藏环境；开门、供电中断、制冷异常或传感器偏移会造成不同的数据表现。本示例中的货物、设备、时间和路线均为合成设置。',monitored_object_and_system:'单个装载冷藏货物的集装箱，包括制冷设备、箱内空气、货物、箱外环境、温湿度传感器、定位与通信模块。真实箱温和箱温传感器读数分别记录，不能把测量偏差当作真实温度变化。',sample_scope:'一条样本对应一个集装箱的一段固定时长运输观测窗口，包含等间隔的多个监测时刻。第一阶段根据本条采样条件安排有序运输阶段及路线；本示例从公路阶段开始，后续可进入港口等待和海运，窗口可以只覆盖完整行程的一部分。发生主要事件的阶段必须出现在窗口内。窗口结束不保证已到达目的地；延误不能通过提高速度或缩短真实航程来补偿。',normal_operation_patterns:'温度设定值在单条样本内保持稳定。制冷设备使箱内空气围绕目标温度小幅波动；送风、回风和货物温度存在差异，货物通常比箱内空气响应更慢。定位沿本样本确定的合成路线连续推进，港口等待时位置保持稳定。第一阶段为每条样本构造具体合成路线、正常阶段时长与初始状态；模板不固定起终点坐标或单次行程。路线距离、运输速度和阶段时长须相容。',event_parameter_relationships:'开门影响内外空气交换；断电影响制冷能力；初始热负载体现在开始时货物较暖及随后的降温；制冷能力下降和气流受阻改变温度关系与响应速度；传感器偏移只改变指定传感器读数；船期延误改变运输阶段安排，不直接制造温度异常。具体幅度、持续时间与恢复方式在第二步定义。',business_constraints:'各字段共享同一时间轴、事件计划与运输阶段。不得让初始热负载在运输中途首次出现，不得在海运行进中安排本示例的开门装卸。网络不可用不等于温度为零。短时断电不必然造成货物超温；出现异常事件也不等于已经达到风险阈值。字段未启用时，不得在最终数据中擅自增加该字段。',other_notes:'本模板中的数值范围和响应幅度是可修改的合成演示假设，不是特定设备的实测标定参数。模型生成面向少量样本；需要设备级精度时应采用经过校准的引擎或实测数据。'},sampling_dimensions:COLDCHAIN_MODEL_DIMENSIONS,event_definitions:COLDCHAIN_MODEL_EVENTS,allowed_events:COLDCHAIN_MODEL_EVENTS.map(x=>x.event_id),compatibility_rules:COLDCHAIN_COMPATIBILITY},
  generation:{method:'model',field_prompt_mode:'per_field_joint_call'}, fields:COLDCHAIN_MODEL_FIELDS,
  trial_config:{model_alias:'qwen3-14b',quality_model_alias:'qwen3-14b',sample_count:1,step_count:48,interval_minutes:15,start_time:'2026-09-08T08:00:00+08:00',timezone:'Asia/Shanghai',duration_minutes:720}, quality:{base_rules:[],rules:[]}, coverage:null,
};
