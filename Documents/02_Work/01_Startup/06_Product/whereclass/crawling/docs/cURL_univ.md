$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
$session.Cookies.Add((New-Object System.Net.Cookie("_INSIGHT_CK_8310", "31ade610496a4244e21783d63974ba7f_29977|74d39e025b9d507b237583d63974ba7f_29977:1738631777000", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_INSIGHT_CK_8304", "9be7d602ebe1b08e218cf1eae317370d_23732|535301081921315f37a5f1eae317370d_23732:1738725532000", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_TLGTB7MN14", "GS1.1.1742432267.26.1.1742432281.0.0.0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_QGX8XGKVMF", "GS1.1.1743048486.1.0.1743048505.0.0.0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_INSIGHT_CK_8301", "1a426b0cbf114041614e8d42874dc09c_41898|e8b70e10a1935242b27b05f4b155bda1_79247:1746581047000", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_E0C08CRK91", "GS2.1.s1746579248`$o12`$g1`$t1746579401`$j0`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("WMONID", "DCXGdO2H4Ad", "/", "underwood1.yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_WJW6YCYJE0", "GS2.1.s1757510607`$o5`$g0`$t1757510607`$j60`$l0`$h339683857", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_V57JH1CC12", "GS2.1.s1757572639`$o4`$g0`$t1757572639`$j60`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_FYE4JG5NSR", "GS2.1.s1761322702`$o2`$g1`$t1761323678`$j60`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_WC9YWKBJ4M", "GS2.1.s1765809239`$o18`$g1`$t1765809260`$j39`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("AMCV_686A3E135A2FEC210A495C17%40AdobeOrg", "-306458230%7CMCIDTS%7C20473%7CMCMID%7C92106586725451619397587905535518250260%7CMCOPTOUT-1768843099s%7CNONE%7CvVersion%7C3.2.0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_PR53ZRCM8X", "GS2.1.s1770182945`$o13`$g1`$t1770183094`$j60`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_MQFECG6BXL", "GS2.1.s1771561383`$o97`$g0`$t1771561391`$j52`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_3SLTQ9SFRW", "GS2.1.s1772604984`$o122`$g1`$t1772605050`$j57`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_BF7GKSC9KN", "GS2.1.s1772676367`$o116`$g1`$t1772676408`$j19`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga", "GA1.3.1089283070.1723005827", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_gid", "GA1.3.208373067.1772967772", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("JSESSIONID", "4U0RV3v8fglcb8W58Z3sNGPa9K16bYnSwf1ZAbFfWai1lqDCtZkp4vQ9Zy1YGBiM.aGFrc2FfZG9tYWluL2hha3NhMV8x", "/", "underwood1.yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("NetFunnel_ID", "", "/", "underwood1.yonsei.ac.kr")))
Invoke-WebRequest -UseBasicParsing -Uri "https://underwood1.yonsei.ac.kr/sch/sles/SlescsCtr/findSchSlesHandbList.do" `
-Method "POST" `
-WebSession $session `
-Headers @{
"Accept"="*/*"
  "Accept-Encoding"="gzip, deflate, br, zstd"
  "Accept-Language"="ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
  "Origin"="https://underwood1.yonsei.ac.kr"
  "Referer"="https://underwood1.yonsei.ac.kr/com/lgin/SsoCtr/initExtPageWork.do?link=handbList&locale=ko"
  "Sec-Fetch-Dest"="empty"
  "Sec-Fetch-Mode"="cors"
  "Sec-Fetch-Site"="same-origin"
  "X-Requested-With"="XMLHttpRequest"
  "sec-ch-ua"="`"Not:A-Brand`";v=`"99`", `"Google Chrome`";v=`"145`", `"Chromium`";v=`"145`""
  "sec-ch-ua-mobile"="?0"
  "sec-ch-ua-platform"="`"Windows`""
} `
-ContentType "application/x-www-form-urlencoded; charset=UTF-8" `
-Body "_menuId=MTA5MzM2MTI3MjkzMTI2NzYwMDA%3D&_menuNm=&_pgmId=NDE0MDA4NTU1NjY%3D&%40d1%23dsNm=dsUnivCd&%40d1%23level=B&%40d1%23lv1=s2&%40d1%23lv2=%25&%40d1%23lv3=%25&%40d1%23sysinstDivCd=%25&%40d1%23univGbn=A&%40d1%23findAuthGbn=8&%40d1%23syy=2026&%40d1%23smtDivCd=10&%40d%23=%40d1%23&%40d1%23=dmCond&%40d1%23tp=dm&"