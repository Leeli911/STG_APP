Repair the following STG output.

Target Schema:

{{target\_schema\_name}}

Original Question:

{{question}}

Original User Answer:

{{user\_answer}}

Invalid Output:

{{invalid\_output}}

Return only repaired JSON.

If target\_schema\_name is "analysis", use this schema:

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

"deductions": []

},

{

"dimension": "core\_message",

"score": 0,

"max\_score": 20,

"evidence": "string",

"deductions": []

},

{

"dimension": "structure",

"score": 0,

"max\_score": 25,

"evidence": "string",

"deductions": []

},

{

"dimension": "evidence",

"score": 0,

"max\_score": 20,

"evidence": "string",

"deductions": []

},

{

"dimension": "interview\_impact",

"score": 0,

"max\_score": 15,

"evidence": "string",

"deductions": []

}

],

"diagnosis": [],

"quality\_flags": []

}

If target\_schema\_name is "coaching", use this schema:

{

"score": {

"total": 0,

"score\_band": "excellent | strong | good | basic | weak | poor",

"learning\_level": "Level 1 | Level 2 | Level 3 | Level 4",

"summary": "string"

},

"dimension\_scores": [],

"diagnosis": [],

"rewrite": {

"version\_type": "coach\_rewrite",

"rewrite\_goal": "string",

"structure\_used": "string",

"text": "string",

"fact\_preservation\_note": "string"

},

"why\_better": [],

"growth\_suggestion": {

"focus\_for\_next\_practice": "string",

"micro\_drill": "string",

"example\_sentence\_frame": "string",

"estimated\_next\_level": "Level 1 | Level 2 | Level 3 | Level 4"

},

"quality\_flags": []

}
