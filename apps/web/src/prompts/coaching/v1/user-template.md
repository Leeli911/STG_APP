Create coaching output for the following interview answer.

Question:

{{question}}

User Answer:

{{user\_answer}}

Optional Target Role:

{{target\_role}}

Optional Language:

{{language}}

Analysis Result:

{{analysis\_json}}

Return only JSON in this schema:

{

"score": {

"total": 0,

"score\_band": "excellent | strong | good | basic | weak | poor",

"learning\_level": "Level 1 | Level 2 | Level 3 | Level 4",

"summary": "string"

},

"dimension\_scores": [

{

"dimension": "relevance",

"score": 0,

"max\_score": 20,

"display\_name": "题目相关性",

"evidence": "string"

},

{

"dimension": "core\_message",

"score": 0,

"max\_score": 20,

"display\_name": "结论先行",

"evidence": "string"

},

{

"dimension": "structure",

"score": 0,

"max\_score": 25,

"display\_name": "结构清晰度",

"evidence": "string"

},

{

"dimension": "evidence",

"score": 0,

"max\_score": 20,

"display\_name": "证据与细节",

"evidence": "string"

},

{

"dimension": "interview\_impact",

"score": 0,

"max\_score": 15,

"display\_name": "面试说服力",

"evidence": "string"

}

],

"diagnosis": [

{

"issue\_id": "D001",

"issue\_type": "string",

"severity": "high | medium | low",

"location": "opening | middle | ending | whole\_answer",

"title": "string",

"evidence": "string",

"why\_it\_matters": "string",

"fix\_direction": "string"

}

],

"rewrite": {

"version\_type": "coach\_rewrite",

"rewrite\_goal": "string",

"structure\_used": "string",

"text": "string",

"fact\_preservation\_note": "string"

},

"why\_better": [

{

"change\_type": "opening\_upgrade | structure\_upgrade | evidence\_upgrade | interview\_fit\_upgrade | concision\_upgrade | tone\_upgrade",

"changed\_what": "string",

"why\_changed": "string",

"impact": "string"

}

],

"growth\_suggestion": {

"focus\_for\_next\_practice": "string",

"micro\_drill": "string",

"example\_sentence\_frame": "string",

"estimated\_next\_level": "Level 1 | Level 2 | Level 3 | Level 4"

},

"quality\_flags": [

{

"flag\_type": "string",

"severity": "high | medium | low",

"message": "string"

}

]

}
