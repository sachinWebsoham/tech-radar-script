const cheerio = require("cheerio");
const urlParser = require("url");
const axios = require("axios");
const { supabase } = require("../config/config");
const TLDs = require("./tldList");
const ccLTD = require("./cctldList");
const ignoreExtention = [
  "webp",
  "mp3",
  "wav",
  "m4a",
  "flac",
  "aac",
  "mp4",
  "avi",
  "mkv",
  "mov",
  "wmv",
  "jpeg",
  "jpg",
  "png",
  "gif",
  "tiff",
  "raw",
];
const validDomain = (domain) => {
  let validDomain;
  try {
    const domainPart = domain.split(".").filter((part) => part !== "");
    const partLength = domainPart.length;
    switch (true) {
      case partLength == 2 &&
        (TLDs.includes(domainPart[partLength - 1]) ||
          ccLTD.includes(domainPart[partLength - 1])):
        validDomain = `https://${domainPart.join(".")}`;
        break;
      case partLength == 3 &&
        ccLTD.includes(domainPart[partLength - 1]) &&
        TLDs.includes(domainPart[partLength - 2]):
        validDomain = `https://${domainPart.join(".")}`;
        break;
      case partLength == 3 && TLDs.includes(domainPart[partLength - 1]):
        validDomain = `https://${domainPart.slice(1).join(".")}`;
        break;
      case partLength == 3 && ccLTD.includes(domainPart[partLength - 1]):
        validDomain = `https://${domainPart.slice(1).join(".")}`;
        break;
      case partLength > 3 &&
        ccLTD.includes(domainPart[partLength - 1]) &&
        TLDs.includes(domainPart[partLength - 2]):
        const startIndex = Math.max(0, partLength - 3);
        validDomain = `https://${domainPart.slice(startIndex).join(".")}`;
        break;
      case partLength > 3 && ccLTD.includes(domainPart[partLength - 1]):
        const startIndex1 = Math.max(0, partLength - 2);
        validDomain = `https://${domainPart.slice(startIndex1).join(".")}`;
        break;
      case partLength > 3 && TLDs.includes(domainPart[partLength - 1]):
        const startIndex2 = Math.max(0, partLength - 2);
        validDomain = `https://${domainPart.slice(startIndex2).join(".")}`;
        break;
      default:
        validDomain = "Invalid domain";
    }
    return validDomain;
  } catch (error) {
    // console.log("Error-validDomain:", error.message);
  }
};
const checkLinkStatus = async (url) => {
  try {
    const response = await axios.head(url);
    return response.status;
  } catch (error) {
    return error.response ? error.response.data : 0;
  }
};

const seenUrls = {};
let pages = [];
const getUrl = (link, host, defaultProtocol = "https://") => {
  try {
    pages.push(link);
    if (link.includes("http")) {
      return link;
    } else if (link.startsWith("/")) {
      return `${defaultProtocol}//${host}${link}`;
    } else {
      return `${defaultProtocol}//${host}/${link}`;
    }
  } catch (error) {
    // console.log(error.message);
  }
};
let counter = 1;
const crawl = async ({ url, ignore }) => {
  try {
    if (seenUrls[url]) return;
    seenUrls[url] = true;
    const { host, protocol } = urlParser.parse(url);
    const response = await axios.get(url);
    const contentType = response.headers["content-type"];

    if (!contentType.includes("text/html")) return;
    const $ = cheerio.load(response.data);
    const links = $("a")
      .map((i, link) => link.attribs.href)
      .get();

    await Promise.all(
      links
        .filter((link) => !link.includes(host) && link.startsWith(protocol))
        .map(async (link) => {
          let linkObj = urlParser.parse(link).hostname;
          if (linkObj.startsWith("www.")) {
            linkObj = linkObj.replace(/^www\./, "");
          }
          const validUrl = validDomain(linkObj);
          const { data } = await supabase
            .from("crawling_external_link")
            .select()
            .eq("url", validUrl);
          if (!data?.length) {
            const linkStatus = await checkLinkStatus(validUrl);
            await supabase
              .from("crawling_external_link")
              .insert({ url: validUrl, status_code: linkStatus });

            if (linkStatus != 200) {
              if (!seenUrls[validUrl]) {
                seenUrls[validUrl] = true;
                const domainForFilter = new URL(validUrl).hostname;
                if (brokenUrl?.includes(domainForFilter)) {
                  brokenUrl.push(domainForFilter);
                  console.log(domainForFilter, "broken");
                }
              }
            }

            // check status code
          }
        })
    );
    const internalLink = links.filter(
      (link) => link.includes(host) && !link.includes(ignore)
    );
    internalLink.forEach(async (link) => {
      const endsWithignoreExtention = ignoreExtention.some((extension) =>
        link.toLowerCase().endsWith(extension)
      );
      if (!endsWithignoreExtention) {
        await supabase.from("crawling_page_link").insert({ page_url: link });
      }
    });
    internalLink.forEach((link) => {
      crawl({
        url: getUrl(link, host, protocol),
        ignore,
      });
    });
  } catch (error) {
    console.log("crawl", error.message);
  }
};

if (process.argv.length > 2) {
  const url = process.argv[2];

  crawl({
    url: url,
    ignore: "/search",
  }).then(() => {
    console.log("running");
  });
} else {
  console.log("No url found.");
}
