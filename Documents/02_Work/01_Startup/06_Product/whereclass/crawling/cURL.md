$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_KVNN70JSVE", "GS1.1.1736921205.1.0.1736921210.0.0.0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_WBT1GNJGQG", "GS1.1.1737421461.8.1.1737421498.0.0.0", "/", ".yonsei.ac.kr")))
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
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_MQFECG6BXL", "GS2.1.s1768531055`$o93`$g1`$t1768532329`$j60`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("AMCV_686A3E135A2FEC210A495C17%40AdobeOrg", "-306458230%7CMCIDTS%7C20473%7CMCMID%7C92106586725451619397587905535518250260%7CMCOPTOUT-1768843099s%7CNONE%7CvVersion%7C3.2.0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_3SLTQ9SFRW", "GS2.1.s1768972536`$o116`$g1`$t1768972543`$j53`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga", "GA1.1.1089283070.1723005827", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_PR53ZRCM8X", "GS2.1.s1769059710`$o12`$g0`$t1769059715`$j55`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_BF7GKSC9KN", "GS2.1.s1769171736`$o94`$g1`$t1769171744`$j52`$l0`$h0", "/", ".yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("JSESSIONID", "2Ev1tHeaYKkg1dv2NVaNTcDiJjU6xmjNd8wjNLEM0pcuh8BRtjW1lipHw5OCc2xd.aGFrc2FfZG9tYWluL2hha3NhMl8x", "/", "underwood1.yonsei.ac.kr")))
$session.Cookies.Add((New-Object System.Net.Cookie("NetFunnel_ID", "5002%3A200%3Akey%3DA9D3D49C271807474527DD62C0192A8055D50708E469A99ECB6734365CFAD720338C8F30C105D956E8F612A211C5DEF891B98261E20672B8D3D9DFC9E3BCA10529C1CDCCE7681CD841409E8137C89C3F4C439340C556720AE22832973ADBDB0204A0097A16CA43A3A6D4409BB9AA45CD2C30%26nwait%3D0%26nnext%3D0%26tps%3D0.000000%26ttl%3D0%26ip%3Dnfl.yonsei.ac.kr%26port%3D443", "/", "underwood1.yonsei.ac.kr")))
Invoke-WebRequest -UseBasicParsing -Uri "https://underwood1.yonsei.ac.kr/sch/sles/SlessyCtr/findAtnlcHandbList.do" `
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
  "sec-ch-ua"="`"Not(A:Brand`";v=`"8`", `"Chromium`";v=`"144`", `"Google Chrome`";v=`"144`""
  "sec-ch-ua-mobile"="?0"
  "sec-ch-ua-platform"="`"Windows`""
} `
-ContentType "application/x-www-form-urlencoded; charset=UTF-8" `
-Body "_menuId=MTA5MzM2MTI3MjkzMTI2NzYwMDA%3D&_menuNm=&_pgmId=NDE0MDA4NTU1NjY%3D&%40d1%23syy=2026&%40d1%23smtDivCd=10&%40d1%23campsBusnsCd=s2&%40d1%23univCd=&%40d1%23faclyCd=&%40d1%23hy=&%40d1%23cdt=%25&%40d1%23kwdDivCd=1&%40d1%23searchGbn=1&%40d1%23kwd=&%40d1%23allKwd=&%40d1%23engChg=&%40d1%23prnGbn=false&%40d1%23lang=&%40d1%23campsDivCd=&%40d1%23stuno=&%40d%23=%40d1%23&%40d1%23=dmCond&%40d1%23tp=dm&"