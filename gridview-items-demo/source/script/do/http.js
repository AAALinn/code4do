//---------------------------------------------------------------
//访问http的服务
//测试数据必须存放在：initdata://mock/ 子目录下
//为了方便当前文件的升级，不建议直接修改该文件，如果需要修改相关的配置，请在httpSetting.js中修改
//version: 1.0.0
//---------------------------------------------------------------
var core=require("do/core");
var do_Storage = core.sm("do_Storage");
var do_Global = core.sm("do_Global");
var do_Algorithm = core.sm("do_Algorithm");
var do_InitData=core.sm("do_InitData");

//---------------------------------------------------------------
function builderurlencoded(options){
	if (options.data ==null) return "";
	var _paraStr="";
	if (typeof(options.data) == "string"){
		_paraStr=options.data;
	}
	else{
		for(var _key in options.data){
			if (_paraStr.length > 0){
				_paraStr += "&";
			}
			_paraStr= _paraStr + encodeURIComponent(_key)+"=" + encodeURIComponent(options.data[_key]);
		}
	}	
	return _paraStr;
}
function builderFullUrl(options){
	if (options.data ==null) return options.url;
	var _paraStr=builderurlencoded(options);
	if (_paraStr.length <=0) return options.url;
	if (options.url.indexOf("?") >=0){
		return options.url + "&" + _paraStr;
	}
	return options.url + "?" + _paraStr;
}
function callbackFunc(options, _oldData, data, status){
	var isSucceed= false;
	if (('' + status).indexOf("2")==0 ){
		//返回码以2开头的都算是成功
		isSucceed=true;
	}
	if (options.cacheLastResult){
		if (!_oldData && _oldData== data) return;
		if (isSucceed){
			var _fUrl=builderFullUrl(options);
			var _cacheFile = "data://httpCache/" + options.type  +"/" + do_Algorithm.md5Sync("string", _fUrl);
			do_Storage.writeFile(_cacheFile, data);
		}
	}
	if (options.dataFilter){
		options.dataFilter.call(this, data);
	}
	if (isSucceed){
		if (options.success) options.success.call(this, data, status);
	}
	else{
		if (options.error) options.error.call(this, data, status);
	}
	
	if (options.complete) options.complete.call(this, data);
}
function checkMock(_fUrl, _oldData, options){
	if (!options.useMockData) return false;
	for(var i =0;i< options.mockData.length; i++){
		var _mock = options.mockData[i];
		_mock.type=_mock.type||"GET";
		if (_fUrl.indexOf(_mock.url) ==0 && _mock.result && _mock.type==options.type){
			var _mockFile = "initdata://mock/" + _mock.result;
			if (!do_InitData.fileExist(_mockFile)){
				core.p("未找到mock文件：" + _mockFile);
				return false;
			}
			do_InitData.readFile(_mockFile, function(data) {
				callbackFunc(options, _oldData, data, _mock.status);
			});
			return true;
		}
	}
	core.p("=============> undefined http mock url： " + options.type + "：" + _fUrl);
	return false;
}
function callajax(_fUrl, _oldData, options){	
	var _realUrl=options.url;
	if (options.type=="GET" || options.type=="DELETE"){
		_realUrl=_fUrl;
	}
	if (_realUrl.indexOf("http://") !=0 && _realUrl.indexOf("https://") !=0){
		_realUrl = options.rootUrl + "/" + _realUrl;
	}
	var _http = core.mm("do_Http");
	_http.url = _realUrl;
	if (options.contentType =="application/x-www-form-urlencoded")
	{
		_http.body = builderurlencoded(options.data);
	}
	else{
		_http.body = options;
	}	
	_http.method = options.type;
	_http.timeout = options.timeout;
	_http.contentType = options.contentType;
	_http.responseEncoding=options.responseEncoding;
	_http.on("result", function(data){
		callbackFunc(options, _oldData, data.data, data.status);
	});
	if (options.beforeSend){
		options.beforeSend.call(this, options, _http);
	}
	_http.request();
}
function ajax( url, options){
	if ( typeof url === "object" ) {
		options = url;
		url = null;
	}
	var d=core.getOptions(options, "do/httpSetting");
	d.mockData=d.mockData||[];
	d.type=d.type||"GET";
	d.type=d.type.toUpperCase();
	if (url) d.url=url;
	var _fUrl=builderFullUrl(d);
	var _cacheFile="";
	if (d.cacheLastResult){
		var _cacheFile = "data://httpCache/" + d.type  +"/" + do_Algorithm.md5Sync("string", _fUrl);
		if (do_Storage.fileExist(_cacheFile)){
			do_Storage.readFile(_cacheFile, function(data) {
				if (d.dataFilter) d.dataFilter.call(this, data);
				if (d.success) d.success.call(this, data, 200);
				if (checkMock(_fUrl, data, d)) return;
				callajax(_fUrl, data, d);
			});
			return;
		}
	}
	if (checkMock(_fUrl, null, d)) return;
	callajax(_fUrl, null, d);
}


//---------------------------------------------------------------
/**
 * ajax访问http服务，默认配置在httpSetting.js中配置
 * @param url 访问的url路径，可以是相对于rootUrl的路径
 * @param options 传入的选项内容
		//上级选项名称（可继承选项内容）
		parent:null,
		//服务请求的根路径
		rootUrl:"",
		//服务请求的url（如果不是以http://或https://开始，则会自动加上httpRootUrl变量值的前缀）
		url:null,
		//请求的类型（GET,POST, PUT, DELETE）。
		type:"GET",
		//发送数据到服务器时所使用的内容类型。可以是："application/x-www-form-urlencoded", "application/json"
		contentType:"application/x-www-form-urlencoded; charset=UTF-8",
		//要发送到服务器的数据，发送前可以根据需要自动转换为请求字符串格式（例如：{a:"1", b:"2"}，对于GET请求可自动转换为&a=1&b=2）
		data:null,
		//返回内容的解码方式（utf-8或GBK）
		responseEncoding:"utf-8",
		//设置本地的请求超时时间（以毫秒计）
		timeout:30000,
		//发送请求前运行的函数:beforeSend(options, do_Http)
		beforeSend:null,
		//返回数据后的进行预处理的函数:dataFilter(data)
		dataFilter:null,
		//当请求成功时运行的函数success(data, status)
		success:null,
		//如果请求失败要运行的函数error(data, status)
		error:null,
		//请求完成时运行的函数（在请求成功或失败之后均调用，即在 success 和 error 函数之后）complete(data, status)
		complete:null,
		//是否缓存上次结果 （为true的时候，在返回服务结果之前会先返回上次结果，一般用于改善数据查询的交互体验）
		cacheLastResult:false,
		//是否使用测试数据
		useMockData:false,
		//测试数据
		mockData:null
 */
module.exports.ajax = function( url, options){
	ajax(url, options);
};

