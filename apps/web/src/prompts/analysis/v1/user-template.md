Analyze the following interview answer.

Question:

{{question}}

User Answer:

{{user\_answer}}

Optional Target Role:

{{target\_role}}

Optional Language:

{{language}}

Return only JSON in this schema:

{

"question\_analysis": {

"question\_type": "self\_introduction | project\_experience | behavioral | motivation | strength\_weakness | career\_plan | technical | business\_case | other",

"expected\_structure": "string",

"requires\_example": true,

"requires\_metric": true,

"requires\_role\_fit": true

},

"observable\_features": {

"answer\_length\_chars": 0,

"main\_point\_position": {

"status": "first\_sentence | early | middle | late | missing",

"char\_index": 0,

"evidence": "string"

},

"has\_clear\_opening\_claim": true,

"has\_structure\_markers": true,

"has\_specific\_example": true,

"has\_personal\_action": true,

"has\_result": true,

"has\_metric": true,

"has\_role\_fit": true,

"repetition\_level": "none | low | medium | high",

"off\_topic\_level": "none | low | medium | high",

"star\_completeness": {

"situation": true,

"task": true,

"action": true,

"result": true

}

},

"score": {

"total": 0,

"score\_band": "excellent | strong | good | basic | weak | poor",

"learning\_level": "Level 1 | Level 2 | Level 3 | Level 4"

},

"dimension\_scores": [

{

"dimension": "relevance",

"score": 0,

"max\_score": 20,

"evidence": "string",

"deductions": [

{

"rule": "string",

"points": 0,

"reason": "string"

}

]

},

{

"dimension": "core\_message",

"score": 0,

"max\_score": 20,

"evidence": "string",

"deductions": [

{

"rule": "string",

"points": 0,

"reason": "string"

}

]

},

{

"dimension": "structure",

"score": 0,

"max\_score": 25,

"evidence": "string",

"deductions": [

{

"rule": "string",

"points": 0,

"reason": "string"

}

]

},

{

"dimension": "evidence",

"score": 0,

"max\_score": 20,

"evidence": "string",

"deductions": [

{

"rule": "string",

"points": 0,

"reason": "string"

}

]

},

{

"dimension": "interview\_impact",

"score": 0,

"max\_score": 15,

"evidence": "string",

"deductions": [

{

"rule": "string",

"points": 0,

"reason": "string"

}

]

}

],

"diagnosis": [

{

"issue\_id": "D001",

"issue\_type": "missing\_core\_message | late\_core\_message | vague\_core\_message | no\_clear\_structure | background\_too\_long | action\_missing | result\_missing | lack\_example | lack\_metric | repetition | unsupported\_claim | weak\_role\_fit | over\_humble | overclaim | off\_topic | other",

"severity": "high | medium | low",

"location": "opening | middle | ending | whole\_answer",

"evidence": "string",

"why\_it\_matters": "string"

}

],

"quality\_flags": [

{

"flag\_type": "string",

"severity": "high | medium | low",

"message": "string"

}

]

}
