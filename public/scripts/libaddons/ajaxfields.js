/**
 * This is a stand-alone lib for modular ajax fields. 
 * Should not have any external dependencies, except DOThtml (and maybe DOTcss for the time being).
 * Current dependencies:
 * -DOThtml for UI.
 * -DOTcss for styles.
 * -Howler core for audio playback.
 */

(function(){

    var blur = function(e){
        e.target.blur();
    }

    var save = function(e, onchange){
        var thisNode = e.target;
        var savingNode = thisNode.nextSibling;
        var outputNode = savingNode.nextSibling;
        dotcss(thisNode).display("none");
        dotcss(savingNode).display("block");
        //console.log(value);
        onchange(thisNode.value, function(errMsg){
            dotcss(savingNode).display("none");
            dotcss(outputNode).opacity(1);
            if(!errMsg){
                //Value confirmed.
                outputNode.innerHTML = "";
                setVal = e.target.value;
                var textNode = document.createTextNode(setVal);
                outputNode.appendChild(textNode);
                if(outputNode.innerHTML === "") outputNode.innerHTML = "[click to set]";
                dotcss(outputNode).backgroundColor(0xaa, 0xff, 0xaa, 1);
                dotcss(outputNode).backgroundColor.animate([0xcc, 0xcc, 0xdd, 1], 1000);
            }
            else{
                //Reset Value
                alert(errMsg); //TODO: make a fancy dialog for this.
                e.target.value = setVal;
            }
        })
    }

    /**
     * Handles changes in a file input by reading the file and 
     * @param {object} e - Button being pressed.
     * @param {string} type - Type of media (image/audio).
     * @param {function} onread - function to call once the file is read.
     */
	function uploadFiles(e, type, onread){
        var target = e.target;
        var savingNode = target.nextSibling;
        var previewNode = target.previousSibling;
        var files = target.files;
        var file = files[0];
        dotcss(target).hide();
        dotcss(savingNode).show();
		//TODO: verify it's an image.
		var reader = new FileReader();
		reader.onload = function(){
            //console.log(reader.result); //Don't do this.
            if(type == "image"){
                dotcss(previewNode).backgroundImage(reader.result);
            }
            onread(reader.result, function(errMsg, url){
                dotcss(target).show();
                dotcss(savingNode).hide();
                if(!errMsg){
                    
                }
                else{
                    alert(errMsg);
                }
            });
        }
        /*onchange(files[0], function(errMsg, url){
            dotcss(target).show();
            dotcss(savingNode).hide();
            if(!errMsg){
                
            }
            else{
                alert(errMsg);
            }
        });*/

		reader.readAsDataURL(file);
	}

    dot.createWidget("inputview", function(type, value, onchange){
        var setVal = value === undefined ? "" : value;
        //console.log(setVal);
        return dot.div(
            dot.if(type == "textarea", function(){return dot.textarea(dot.t(setVal)).onkeyup(function(e){if(e.keyCode == 27) {e.target.value = setVal; blur(e);}})})
            .else(function(){return dot.input().type(type).value(setVal).onkeyup(function(e){if(e.keyCode == 13) blur(e); else if(e.keyCode == 27) {console.log(setVal); e.target.value = setVal; blur(e);}});})
            .style(dotcss.position("absolute").zIndex(2).top(0).left(0).display("none")).onblur(function(e){save(e, onchange); setVal = e.target.value; /*console.log(e.target.value);*/})

            .div(dot.img().src("./images/savinggif.gif")).style(dotcss.position("absolute").display("none").fontStyle("italic"))
            
            .div(setVal === "" ? "[click to set]" : dot.t(setVal))
            .style(
                dotcss.fontWeight("bold")
                .opacity(1)
                .cursor("pointer")
                .backgroundColor("#ccccdd")
                .minHeightEm(1)
                //.textOverflow("ellipsis")
                //.whiteSpace("nowrap")
                .maxWidth(200)
                .overflow("hidden")
            )
            .onclick(function(e){
                //console.log(e.target.style.opacity);
                if(e.target.style.opacity == "1"){
                    dotcss(e.target).opacity(0); //This prevents the space it occupies from collapsing.
                    dotcss(e.target.previousSibling.previousSibling).display("block");
                    e.target.previousSibling.previousSibling.focus();
                }
            })
            
        ).style(dotcss.position("relative"))
    });

    dot.createWidget("textboxview", function(value, onchange){
        return dot.inputview("text", value, onchange);
    });

    dot.createWidget("numberboxview", function(value, onchange){
        return dot.inputview("number", value, onchange);
    });

    dot.createWidget("checkboxview", function(value, onchange){
        console.error("checkboxes not supported yet.");
        //return dot.inputview("checkbox", value, onchange);
    });

    dot.createWidget("textareaview", function(value, onchange){
        return dot.inputview("textarea", value, onchange);
    });

    dot.createWidget("dateboxview", function(value, onchange){
        var date = "";
        if(value){
            date = new Date(value);
            value = date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2);
        }
        return dot.inputview("date", value, onchange);
    });

    dot.createWidget("audioboxview", function(value, onchange, previewBtnAction){
        //console.log(value);
        var myHowl = null;
        var playing = false;
        return dot.div(function(){
            //todo: support drag and drop.
            var ret = dot.div(dot.button("Preview").onclick(function(e){
                if(value){
                    if(!myHowl){
                        myHowl = new Howl({src: ["." + value]});
                    }
                    if(!playing){
                        myHowl.play();
                        playing = true;
                        e.target.innerHTML = "Stop";
                    }
                    else{
                        myHowl.stop();
                        playing = false;
                        e.target.innerHTML = "Preview";
                    }
                }
            })).style(dotcss.display(value ? "block" : "none"));
            var playPauseBtn = ret.getLast();
            return ret.input().type("file").enctype("multipart/form-data").accept("audio/*").onchange(function(e){
                uploadFiles(e, "image", function(result, callback){
                    value = result;
                    if(result){
                        dotcss(playPauseBtn).display("block");
                    }
                    onchange(uri, callback);
                });
            })
            .div(dot.img().src("./images/savinggif.gif")).style(dotcss.display("none").fontStyle("italic"))
        }).style(dotcss.widthP(100));
    });

    dot.createWidget("imageboxview", function(value, onchange){
        //console.log(value);
        return dot.div(
            //todo: support drag and drop.
            dot.div().style(dotcss.height(56).width(64).backgroundImage(value ? "." + value : "./images/sample.jpg").backgroundSize("contain").backgroundPosition("50% 50%").backgroundRepeat("no-repeat"))
            .input().type("file").accept("image/*").enctype("multipart/form-data").onchange(function(e){
                uploadFiles(e, "image", function(value, callback){
                    onchange(value, callback);
                });
            })
            .div(dot.img().src("./images/savinggif.gif")).style(dotcss.display("none").fontStyle("italic"))
        ).style(dotcss.widthP(100));
    });
})();