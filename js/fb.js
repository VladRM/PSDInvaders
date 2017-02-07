window.fbAsyncInit = function() {
  FB.init({
    appId      : '1191284050911606',
    xfbml      : true,
    version    : 'v2.6'
  });
};

(function(d, s, id){
   var js, fjs = d.getElementsByTagName(s)[0];
   if (d.getElementById(id)) {return;}
   js = d.createElement(s); js.id = id;
   js.src = "//connect.facebook.net/en_US/sdk.js";
   fjs.parentNode.insertBefore(js, fjs);
 }(document, 'script', 'facebook-jssdk'));
   
FbPsdInvaders = {
    
    share : function() {
        FB.ui(
            {
             method: 'share',
             href: window.location.href
            }, function(response){}
        );
    }
    
}