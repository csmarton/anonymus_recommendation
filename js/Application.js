Application = {
  matrix : [
    [0,0,0,1,1],
    [1,1,1,1,0],
    [0,0,0,0,1],
    [1,1,0,0,0],
    [0,1,1,0,0],
  ],
  users : null,
  graph : null,
  graphEdges : null,
  grapgNodes : null,
  isSatisfiedUser : [],
  inIgnoreList : [],
  vectors : null,

  edges : [[]], // edges on node
  userNodes : [],
  preferenceNodes : [],
  nextMove : false,

  algorithmTimeout : null,
  oneStep : true,
  stepCount : 0,
  bValue : null,
  actualAlgorithmData : {
    val : -1,
    b : -1
  },
  end : false,

  init : function(){
    this.matrix = Matrices.matrix1;
    this.setEventListener();
    this.initVector();
    this.constructConsistencyGraph(this.users, this.vectors);
  },
  // main function
  start : function(){
    this.initUserMatrix();
    this.initVector();
    this.constructConsistencyGraph(this.users, this.vectors);
    this.stepCount = 0;
    this.startAlgorithm();
  },

  // initializing the graph
  constructConsistencyGraph : function(users, vectors){
    // add user nodes
    for(var i = 0; i < this.matrix.length; ++i){
      var node = {id: i, label: 'u' + (i+1), font:{size:30}, group:'userGroup'};
      this.userNodes[i] = node;
    }

    // add user preference node
    for(var i = 0; i < this.matrix.length; ++i){
      var node = {id: (this.userNodes.length + i), label: 'v' + (i+1), font:{size:30}, group:'vectorGroup'};
      this.preferenceNodes[i] = node;
    }

    var edgesArray = [];
    // add edges

    for(var i = 0; i < this.matrix.length; ++i){
      //console.log(this.users[i].toString());
      this.edges[i] = [];
      if(this.users[i].indexOf(0) < 0 && this.users[i].indexOf(1) < 0){
        for(var j = 0; j < this.matrix[i].length; ++j){
          this.edges[i][j] = {from: this.userNodes[i].id, to: this.preferenceNodes[j].id, physics : false, smooth : {enable: false}};
          edgesArray.push(this.edges[i][j]);
        }
      }else{
        for(var j = 0; j < this.matrix[i].length; ++j){
          for(var k = 0; k < this.matrix.length; ++k){
            if(this.users[i][k] == this.vectors[k][j]){
              this.edges[i][k] = {from: this.userNodes[i].id, to: this.preferenceNodes[k].id, physics : false};
              edgesArray.push(this.edges[i][k]);
            }
          }
        }
      }
    }


    var container = document.getElementById('diagram');

    var n = this.userNodes.concat(this.preferenceNodes);

    this.graphNodes = new vis.DataSet(n);
    this.graphEdges = new vis.DataSet(edgesArray);

    var data = {
        nodes: this.graphNodes,
        edges: this.graphEdges
    };
    var options = {
      layout: {
        hierarchical: {
          sortMethod: "directed",
          direction: "LR",
          levelSeparation : 500,
        }
      },
      edges: {
        smooth: {
          type: 'continuous',
          roundness : 0,
        },
        arrows: {to : true }
      },
      nodes:{
        shadow:{
          enabled: true,
          size:10,
          x:5,
          y:5
        },
      },
      physics:{
        enabled: true,
      },
    };
    this.graph = new vis.Network(container, data, options);

    this.drawMatrices();
    this.drawStepCount();
  },

  drawMatrices : function(){
    this.renderMatrix(this.users, $('#user-matrix'), "u", true);
    this.renderMatrix(this.vectors, $('#vector-matrix'), "v", false);
    this.renderMatrix(this.matrix, $('#original-matrix'), "v", false);
  },

  drawStepCount : function(){
    $('#step-count').html(this.stepCount);
    $('#b-value').html(this.bValue);
  },

  startAlgorithm : function(){
    var that = this;
    if(that.hasUnsatisfiedUsers())
      (function myLoop (i, b) {
         that.algorithmTimeout = setTimeout(function () {
           that.bValue = b + 1;
            --i;
            that.actualAlgorithmData= {
              val: i == -1? that.users.length : i,
              b : b
            }
            if(b != undefined && b != -1)
              if (i != -1){
                while(that.isSatisfiedUser[i])
                  --i;
                if(i != -1){
                  if(!that.isSatisfiedUser[i]){
                    that.recommend(i, b, i);
    	              ++that.stepCount;

                    that.inIgnoreList.push(b); // hogy ne valasszuk ki megegyszer ezt az indexet
                    that.repairConsistencyGraph(b);
                  }
                }
                if(!that.oneStep)
                  myLoop(i, b);      //  decrement i and call myLoop again if i > 0
              }else if(that.hasUnsatisfiedUsers()){
                that.actualAlgorithmData = {
                  val : that.users.length,
                  b : that.selectMostPopularItemFromUnsatisfiedUsers()
                };
                myLoop(that.actualAlgorithmData.val, that.actualAlgorithmData.b);
              }

         }, 1000)
      })(that.actualAlgorithmData.val, that.actualAlgorithmData.b);
  },

  repairConsistencyGraph : function(uInd){
    var that = this;
  	for(var i = 0; i<this.users.length; i++){
  	  for(var k = 0; k<this.vectors.length; k++){
        for(var j = 0; j<this.vectors[k].length; j++){
          if(this.users[i][j] != this.vectors[k][j] && this.users[i][j] != -1) // ez is kell ide
          {
            var removeEdge = this.edges[i][k];
            this.graphEdges.update({id: removeEdge.id, color: 'red'});
            (function(removeEdge) {
              setTimeout(function () {
                console.log(removeEdge);
                that.graphEdges.remove(removeEdge);
              }, 1000);
            })(removeEdge);
          }
        }
  	   }
    }
    this.drawMatrices();
    this.drawStepCount();
  },
  hasUnsatisfiedUsers : function(){
    for(i = 0; i<this.users.length; i++)
       if(!this.isSatisfiedUser[i]){
         return true;
       }
     return false;
  },

  selectMostPopularItemFromUnsatisfiedUsers : function(){
    var max = -1; //extermalis ertek hogy ennel kisebb nem lehet
    var ind;
    for(var i = 0; i<this.users.length; i++){
      var count = this.countItemsAccordingToUnsatisfiedUsers(i);
      // egyenlőség esetén lehet hogy random kiválasztás kéne a maximumok közül
      if(max < count && this.inIgnoreList.indexOf(i) < 0){ // hogy ne sorsoljuk ki ujra ugyanazt az indexet
        max = count;
        ind = i;
      }
    }
    return ind;
  },

  countItemsAccordingToUnsatisfiedUsers: function(i){
    var count = 0;
    for(var j = 0; j<this.users[i].length; j++){
      if(!this.isSatisfiedUser[i]){
        if(this.vectors[j][i] == 1){
          count++;
        }
      }
    }
    return count;
  },
  recommend : function (i, b, i){
    var user = this.users[i];
    var value = this.matrix[i][b]; //felfedjuk az eredeti matrixban az elemet
    user[b] = value; //user b kell
    var v = {};
    if(this.isSatisfiable(user,v)){ //ez itt nem tagadas
      this.isSatisfiedUser[i] = true;
      var userNode = this.userNodes[i];
      this.graphNodes.update({id: userNode.id, color: 'green'});
    }
  },


  //ez az akar lenni, hogy a user akkor kielegitheto, ha minden helyen, ahol a vektor 1-es, ott a user is 1-es, (fontos hogy nem forditva)
  isSatisfiable(user, v){
	  var satisfiable = true;
	  var count = 0;
    for(var i = 0; i<this.vectors.length; i++){
  	  var satisfiable = true;
        for(var j = 0; j<this.vectors[i].length; j++){
  	    if((user[j] != -1 && user[j] != this.vectors[i][j])){
            satisfiable = false;
          }
        }
  	  if(satisfiable == true){
        v.index = i;
		    count++;
  	  }
    }
	return count == 1;
  },


  initUserMatrix : function() {
    this.users = [];
    for(var i = 0; i<this.matrix.length; i++){
      this.users[i] = [];
      for(var j = 0; j<this.matrix[i].length; j++){
        this.users[i][j] = -1;
      }
    }
  },

  // Permutate the matrix row randomly
  initVector(){
    this.isSatisfiedUser = [];
    this.inIgnoreList = [];

    this.edges = [[]];
    this.userNodes = [];
    this.preferenceNodes = [];

    var array = [];
    for(var i = 0; i<this.matrix.length; i++){
      array[i] = [];
      for(var j = 0; j<this.matrix[i].length; j++){
        array[i][j] = this.matrix[i][j];
      }
    }
    var currentIndex = array.length, temporaryValue, randomIndex ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    this.vectors = array;

    this.vectors = [
      [1,1,0,0,0],
      [0,0,0,1,1],
      [1,1,1,1,0],
      [0,1,1,0,0],
      [0,0,0,0,1]
    ];
    this.initUserMatrix();

    for(var i = 0; i < this.users.length; ++i){
      this.isSatisfiedUser[i] = false;
    }

    this.actualAlgorithmData = {val: this.users.length, b: this.selectMostPopularItemFromUnsatisfiedUsers() };
  },



  renderMatrix : function(v, place, rowName, coloring){
    var m = "<table>";
    for(var i = 0; i < v.length; ++i){
      if(this.isSatisfiedUser[i] && coloring)
        m += "<tr class=\"satified\">";
      else
        m += "<tr>";
      m += "<td>" + rowName + (i+1) + "</td>";
      for(var j = 0; j < v[i].length; ++j){
        m += "<td>" + (v[i][j] != -1? v[i][j] : "&nbsp;") + "</td>";
      }
      m += "</tr>";
    }
    m += "</table>";
    place.html(m);
  },


  initGraph : function(){
    this.isSatisfiedUser = [];
    this.inIgnoreList = [];

    this.edges = [[]];
    this.userNodes = [];
    this.preferenceNodes = [];

    clearTimeout(this.algorithmTimeout);
    this.initUserMatrix();
    this.constructConsistencyGraph(this.users, this.vectors);
    this.stepCount = 0;
    this.bValue = null;
    this.oneStep = true;
    this.drawStepCount();
    this.actualAlgorithmData = {val: this.users.length, b: this.selectMostPopularItemFromUnsatisfiedUsers() };

    for(var i = 0; i < this.users.length; ++i)
      this.isSatisfiedUser[i] = false;

    $('#user-matrix tr').removeClass('satified');
  },

  changeTestCases: function(val){
    switch(val){
      case '1':
        this.matrix = Matrices.matrix1;
        break;
      case '2':
        this.matrix = Matrices.matrix2;
        break;
      default:
        this.matrix = Matrices.matrix1;
        break;
    }

    clearTimeout(this.algorithmTimeout);


    this.initUserMatrix();
    this.initVector();
    this.constructConsistencyGraph(this.users, this.vectors);
    this.stepCount = 0;
    this.bValue = null;
    this.drawStepCount();
  },

  moveOneStep : function(){
    this.startAlgorithm();
  },

  setEventListener : function(){
    var that = this;
    $("body").on('click', '#next-step', function() {
      that.oneStep = true;
      that.moveOneStep();
    });

    $("body").on('click', '#clear', function() {
      that.initGraph();
    });

    $("body").on('click', '#start', function() {
      that.stepCount = 0;
      that.bValue = null;
      that.oneStep = false;
      that.start();
    });

    $("body").on('change', '#select-test-case', function() {
      that.changeTestCases(this.value);
    });
  },


};
