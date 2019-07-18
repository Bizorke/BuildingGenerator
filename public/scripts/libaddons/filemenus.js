(function(){

	var openMenuPane = null;
	var openMenuBtn = null;

	function openMenu(menu, btn){
		var oldBtn = closeMenu();
		if(btn != oldBtn){
			openMenuPane = menu;
			openMenuBtn = btn;
			dotcss(openMenuPane).show({display:"inline-block"});
			openMenuBtn.classList.add("depressed");
			dotcss(fileMenuModel).show();
		}
	}
	
	function closeMenu(){
		var ret = openMenuBtn;
		if(openMenuBtn){
			openMenuBtn.classList.remove("depressed");
			openMenuBtn = null;
		}
		if(openMenuPane){
			dotcss(openMenuPane).hide();
			openMenuPane = null;
		}
		dotcss(fileMenuModel).hide();
		return ret;
	}

	var fileMenuModel = null;

	dot.createWidget("filemenumodel", function(){
		var ret = dot.div().class("filemenumodel").style("display: none;").onclick(function(){
			closeMenu();
		})
		fileMenuModel = ret.getLast();
		return ret;
	});

	dot.createWidget("filemenu", function(menu){
		return dot.if(!fileMenuModel, function(){return dot.filemenumodel();})
		.div().class("filemenuspacer")
		.div(menu).class("filemenu");
	});

	dot.createWidget("filemenudropdown", function(caption, pane){
		return dot.div(function(){
			var btn = null;
			var myPane = pane.getLast();
			var ret = dot.button(caption).class("filemenudropdownbtn").onclick(function(){
				openMenu(myPane, btn);
			});
			btn = ret.getLast();
			ret.h(pane);
			return ret;
		}).class("filemenudropdown");
	});

	dot.createWidget("filemenupane", function(options){
		return dot.div(options).class("filemenupane").style(dotcss.display("none"));
	});

	//Currently, only callbacks are supported.
	dot.createWidget("filemenubtn", function(caption, action){
		return dot.button(caption).class("filemenubtn").onclick(function(){
			closeMenu();
			if(action) action();
		});
	});

	dot.createWidget("filemenuhr", function(){
		return dot.div().class("filemenuhr")
	});

})();