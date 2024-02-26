const filteration = async (urls) => {
  try {
    let data = JSON.stringify({
      domainNames: urls,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.name.com/v4/domains:checkAvailability",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic c2FjaGluc29uaTIwMDI6MzVmNGM0YjlkYTZlNmRmMTRjNTZlYzI5NDgyZTQ0NGRlMDMwM2ZkOQ==",
        Cookie:
          "__cf_bm=YGDtUAEBNLZC.aQ2nXhIuMRFUhidsqQM4Tz6ma1ex3Q-1708931900-1.0-AT6nSRasiX+NV11on/k3rWgSxOzLW6yDqkAfUGCEddsaVw04+TS7Db8RjmggznHbxcjX6QN1b8eTdFiaz4OmX9I=; REG_IDT=03b3f81552d8afd0ca2ebe3794c3224f; TS01b5f4e3=0181d9135da5df0a7949b7c88459ef4048178f7cc9e5339471f1967c59128ac4b10204bd631e08ab29b78517bd4fbbe97b05072fb0",
      },
      data: data,
    };

    const response = await axios.request(config);

    return response.data["results"];
  } catch (error) {
    console.log(error);
    throw error; // You may want to handle the error accordingly
  }
};

const settime = 1000 * 60;
const brokenCheck = async () => {
  console.log("start");
  try {
    const { data } = await supabase
      .from("crawling_external_link")
      .select()
      .neq("status_code", 200)
      .eq("status", false)
      .limit(20);
    console.log(data, "data");
    if (data?.length > 0) {
      const updatedData = data.map((row) => ({ ...row, status: true }));
      const urls = data.map((row) => {
        return new URL(row.url).hostname;
      });
      const result = await filteration(urls);
      const resultUrl = result.map((item) => item.domainName);
      urls.map(async (element) => {
        if (!resultUrl.includes(element)) {
          await supabase.from("crawling_broken_link").insert({ url: element });
        }
      });
      result.forEach(async (element) => {
        if (element) {
          if (element.purchasable) {
            const data = await supabase.from("crawling_broken_link").insert({
              url: element.domainName,
              checked: true,
              result: element,
              availability: true,
            });
            console.log(data, "if");
          } else {
            const data = await supabase.from("crawling_broken_link").insert({
              url: element.domainName,
              checked: true,
              availability: false,
            });
            console.log(data, "else ");
          }
        }
      });
      const { error: updateError } = await supabase
        .from("crawling_external_link")
        .upsert(updatedData);

      if (updateError) {
        console.error("Error updating data:", updateError.message);
      } else {
        console.log("Data updated successfully.");
      }
    }
  } catch (error) {
    console.log("broken_url", error.message);
  }
};
