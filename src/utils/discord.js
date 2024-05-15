export async function sendMessage(content) {

    if (process.env.DISCORD_ENABLED == "true") {
        var params = {
          username: "Docket Service",
          content: content
        }
    
    
        fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: {
              'Content-type': 'application/json'
          },
          body: JSON.stringify(params)
        }).then(res => {
          //  console.log(res);
        }) 
    
      }
}
