I would like to add Neovim syntax highlighting, linting, and autocomplete for a bespoke language whose grammar is quite non-standard. The language is actually more of a data notation than a programming language. You may just have to read more about to decide what its nature is. But I would also like to develop command-line tooling (that works on Mac as well as Arch Linux) that parses this data, e.g. outputting CSVs or sending results to the Google Sheets API. I mention this in case there can be a shared definition of the language for use by Neovim (or Neovim plugin) as well as the tooling. I presume Python would be the best choice for tooling but you may make alternate recommendations.

Now the "language." The language is really just my custom syntax for keeping timesheets, i.e. tracking what I'm doing at each moment. Each hour is divided into five 12-minute "blocks," each block containing three 3-minute "blicks" (invented term), plus 3 minutes of "downtime," which I'll explain as we go. So valid blocks begin at :00, :12, :24, :36, and :48 of each hour. A block is expressed a new line starting with the time in 24-hour format followed by a spaced dash, e.g. "13:48 - ". Then, up to 3 blicks are defined, e.g.

13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3]

A blick is expressed by a blick category in square brackets like "[wr]" (which stands for my writing activity) or "[err]" (which stands for errands) followed by an arbitrary string subject followed by a number of minutes in square brackets which must be "[3]", "[6]" or "[9]"*. The sum of blicks must be 9 minutes. *Actually, a quirk of this language is that instead of [9], a 3-blick blick is notated [10]; more on this later.

To end a block, there is always a triple dash then a precise ending time, followed by an open parenthesis, e.g.

13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (

This means I completed these 3 tasks at 14:02, which is 2 minutes past the end of the block. Here are other valid examples:

13:48 - [wr] brainstorm [3] - [err] do the dishes [6] --- 14:04 (
13:48 - [bkc] read 4 pages [6] - [fit] 10 pushups [3] --- 13:59 (
13:48 - [wr] brainstorm [10] --- 14:13 (

Note that we would never see 13:48 in multiple lines in sequence like this. I am just showing you alternate possibilities for the 13:48 line. Let's talk about various things we see in these examples. One can end earlier than the start of the next block (13:59). One can end arbitrarily late, even past the following block (14:13). There is a shorthand for [10], which is simply omitting it:

13:48 - [wr] brainstorm --- 14:13 (

One may notate the minutes of some tasks with a tilde like this:

13:48 - [wr] brainstorm ~[3] - [err] do the dishes [6] --- 14:04 (

Consider this a helper for humans that doesn't affect the language grammar or parsing in any way; allow it in the grammar but feel free to ignore them during parsing. (The notation is used to mark tasks that don't have a definite end, so they will just be carried out for that number of minutes.) There is a shorthand for ~[10]:

13:48 - [wr] brainstorm ~--- 14:13 (

Now to explain why [10] instead of [9]. Since a block is made up of three 3-minute blicks, there are 3 minutes of unaccounted time per block. These 3 minutes are meant to be a grace period or "downtime," used for anything, including planning and writing out the next block's blicks. The thought was that when an entire block is dedicated to a single task, there is less context-switching so less downtime is needed, and so the official expectation is for the task to take 10 minutes rather than 9. But it doesn't affect the calculus of the system or language; the human is just expected to spend an extra minute on the task.

Here is a realistic example—a sequence of several blocks, including some new syntax we'll explain next:

13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (
14:00 - [err] look up flights ~--- 14:13 (
14:12 - [sp/a] claude ~[6] - [...] f [3] --- 14:28 (
14:24 - [sp/b] slack-up ~[3] - [err] reply to taylor [3] - [bkc] read 3 pages [3] --- 14:42 (
x14:36 - [err] do the dishes [6] --- 14:50 (
14:48 - [wr] brainstorm ~[3] - [bkc] read 2 pages [3] - [wr] brainstorm ~[3] -<- 15:14 (
x15:00 - [bkc] read 2 pages [3] --- 15:19 (
x15:12 - [err] call taylor ~[6] --- 15:25 (
15:24 - [sys] calc ~[3] ... [bkc] read 4 pages [6] <-- 15:35 (

Here's all the new things you see:

"[...]" is a valid category; it's significance is explained later. "[sp/a]" is also a valid category; sometimes a slash is used to distinguish subcategories. But as far as the language is concerned, anything is allowed between the square brackets besides the square bracket characters. This goes for the arbitary string subject too—square brackets are not allowed—square brackets are reserved for categories and minutes—this way parsing can for example safely assume there'll only ever be regexp [^][] (non-square bracket chars) inside the category and for the arbitrary string subjects.
If the previous block ended 6 minutes or after the current block's start time, e.g. 14:42 is exactly 6 minutes after 14:36, then the current block is preceded with an "x". This indicates a shortened block, to help the human catch up. If the human is 6 to 11 minutes behind, the block must have 2 blicks (sum to 6 minutes). If the human is 12 or more minutes behind, the block must have exactly 1 3-minute blick. Later in the example you can see a block that ended very late at 15:14 causing a 1-blick block, which ended at 15:19 which was still more than 6 minutes late, therefore causing the subsequent block to be shortened as well, though only to 2 blicks this time.
There are special versions of the triple dash, "---": They are "<--", ">--", "-<-", "->-". Consider them interchangeable. They are just helpers for the human. Allow them all in the grammar but treat them all like "---".
Another thing to consider interchangeable is a "..." instead of a dash between blicks. Consider this another human marker—allow them in the grammar but treat them all like a single dash.
Now let's find out what the unclosed open parenthesis is about. At the end of each line, inside parentheses, we write the number of "points" (rewards) we receive for how quickly we finished that block of tasks. The number of base points is simply the number of minutes ahead we are since 12 minutes after the previous block's finish (or the start time if this is the first block). Except when we have an "x" block of only 2 or 1 blicks; then instead of 12 minutes, it's 6 and 3 minutes respectively. So here's the previous example with those base points filled in. Tell me if you think there's a mistake in my sample; ask me.

13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (-2
14:00 - [err] look up flights ~--- 14:13 (+1
14:12 - [sp/a] claude ~[6] - [...] f [3] --- 14:28 (-3
14:24 - [sp/b] slack-up ~[3] - [err] reply to taylor [3] - [bkc] read 3 pages [3] --- 14:42 (-2
x14:36 - [err] do the dishes [6] --- 14:50 (-2
14:48 - [wr] brainstorm ~[3] - [bkc] read 2 pages [3] - [wr] brainstorm ~[3] -<- 15:14 (-12
x15:00 - [bkc] read 2 pages [3] --- 15:19 (-2
x15:12 - [err] call taylor ~[6] --- 15:25 (+0
15:24 - [sys] calc ~[3] ... [bkc] read 4 pages [6] <-- 15:35 (+2

If that makes sense exactly, then let's move on. There are more kinds of points possible than the base points, which is why we haven't closed the parentheses. A new kind of line can designate focus categories (as many as one would like, comma-separated). For each unique presence of a focus category in a line, a focus point is awarded, except in an "x" block. Focus points have an "f" suffixed to the number of points.

{focus: [wr], [err]}
13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (-2,+2f
14:00 - [err] look up flights ~--- 14:13 (+1,+1f
14:12 - [sp/a] claude ~[6] - [...] f [3] --- 14:28 (-3
14:24 - [sp/b] slack-up ~[3] - [err] reply to taylor [3] - [bkc] read 3 pages [3] --- 14:42 (-2,+1f
x14:36 - [err] do the dishes [6] --- 14:50 (-2
14:48 - [wr] brainstorm ~[3] - [bkc] read 2 pages [3] - [wr] brainstorm ~[3] -<- 15:14 (-12,+1f
x15:00 - [bkc] read 2 pages [3] --- 15:19 (-2
x15:12 - [err] call taylor ~[6] --- 15:25 (+0,+1f
15:24 - [sys] calc ~[3] ... [bkc] read 4 pages [6] <-- 15:35 (+2

If that makes sense exactly, then let's move on. Another kind of points is the accumulation award. That is an incrementing counter that resets when no focus blick was found, or at an "x" block. New grammar rule: Please allow any amount of whitespace preceding lines in general. Humans may use spaces or tabs for example to track accumulation streaks more easily visually. Tooling can for example just strip leading whitespace out. Accumulation points are suffixed "a" and reset to "+1a" after "+10a". I've added a mix of leading whitespace to demonstrate that they are meaningless:

{focus: [wr], [err]}
13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (-2,+2f,+1a
14:00 - [err] look up flights ~--- 14:13 (+1,+1f,+2a
14:12 - [sp/a] claude ~[6] - [...] f [3] --- 14:28 (-3
14:24 - [sp/b] slack-up ~[3] - [err] reply to taylor [3] - [bkc] read 3 pages [3] --- 14:42 (-2,+1f,+1a
x14:36 - [err] do the dishes [6] --- 14:50 (-2
14:48 - [wr] brainstorm ~[3] - [bkc] read 2 pages [3] - [wr] brainstorm ~[3] -<- 15:14 (-12,+1f,+1a
x15:00 - [bkc] read 2 pages [3] --- 15:19 (-2
x15:12 - [err] call taylor ~[6] --- 15:25 (+0,+1f
15:24 - [sys] calc ~[3] ... [bkc] read 4 pages [6] <-- 15:35 (+2,+1a

Please take care to verify that every arithmetic point rule above makes sense. Ask me if anything doesn't. It could be my mistake.

A new set of focus categories can be declared at any time. Also, one can take a break using ";;;". In this case we can skip an arbitrary number of starting times. Focus categories are still in effect until changed. Accumulation points reset to as if starting over. "x" block rules still apply, e.g. if the last block before the break ended more than 6 or 12 minutes after the next would-have-been start time, then the first block after the break would be a 2-blick or 1-blick block respectively with an "x". Here's an example:

{focus: [wr], [err]}
13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (-2,+2f,+1a
14:00 - [err] look up flights ~--- 14:13 (+1,+1f,+2a
14:12 - [sp/a] claude ~[6] - [...] f [3] --- 14:28 (-3
14:24 - [sp/b] slack-up ~[3] - [err] reply to taylor [3] - [bkc] read 3 pages [3] --- 14:42 (-2,+1f,+1a
x14:36 - [err] do the dishes [6] --- 14:50 (-2
14:48 - [wr] brainstorm ~[3] - [bkc] read 2 pages [3] - [wr] brainstorm ~[3] -<- 15:14 (-12,+1f,+1a
x15:00 - [bkc] read 2 pages [3] --- 15:19 (-2
;;;
x15:36 - [err] call taylor ~[6] --- 15:49 (-1,+1f
15:48 - [sys] calc ~[3] ... [bkc] read 4 pages [6] <-- 15:59 (+2,+1a

Notice we've simply shifted the last two blocks to after a 24-minute break, but the base points have changed from the previous example. That's because I forgot to mention: Base points reset to relative to the new start block, after a break.

Another quirk. At start blocks (first blocks or first blocks after a break), it's possible to start with a 4-blick block with a minute-value of [13]. This is indicated by a start time that starts 4 minutes before the usual 00, 12, 24, 36, 48 boundaries. Notice the first block difference:

{focus: [wr], [err]}
13:44 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] - [sys] check points [3] --- 14:02 (-2,+2f,+1a
14:00 - [err] look up flights ~--- 14:13 (+1,+1f,+2a
14:12 - [sp/a] claude ~[6] - [...] f [3] --- 14:28 (-3
14:24 - [sp/b] slack-up ~[3] - [err] reply to taylor [3] - [bkc] read 3 pages [3] --- 14:42 (-2,+1f,+1a
x14:36 - [err] do the dishes [6] --- 14:50 (-2
14:48 - [wr] brainstorm ~[3] - [bkc] read 2 pages [3] - [wr] brainstorm ~[3] -<- 15:14 (-12,+1f,+1a
x15:00 - [bkc] read 2 pages [3] --- 15:19 (-2
;;;
x15:36 - [err] call taylor ~[6] --- 15:49 (-1,+1f
15:48 - [sys] calc ~[3] ... [bkc] read 4 pages [6] <-- 15:59 (+2,+1a

Nothing is changed in points because instead of counting base points from 12 minutes after the start, it's counted 16 minutes after the start, which keeps things the same. And the [sys] blick we added is not a focus category so no additional points are awarded.

Finally, possibly the most complicated rule, is that "continuation blocks" are possible, i.e. blocks that continue from one line into the next. Instead of the "---" followed by an end time, one can write "+" to mean that this block joins into the next. The next block must begin with the start time followed by a "+" instead of the normal dash. Effectively this is no different than having 2 separate blocks; it just skips an end time (and awarded points) for a block because an end time was not known or not recorded. Base points are awarded relative to 24 minutes since the previous end time (or beginning start time). Here's an example:

{focus: [sys]}
09:24 - [sys] calc [3] - [err] hang clothes [6] --- 09:32 (+2,+1f
09:36 - [sys] calc [3] - [err] start dishwasher [3] - [sys] org 7 [3] +
09:48 + [err] wipe counter, wash pots [6] - [err] put away 5 things [3] --- 10:01 (-5,+1f

Does that make sense? Ask me if you have any questions. The most complicated case of this rule is when "x" blocks are involved. The problem here is that without an end time for the block, we do not know if the next block is also an "x" block or not. The way this is resolved is as follows: A 2-blick "x" block is imagined to have ended 6 minutes after the previous end time (or beginning start time after a break); if that imagined end time is still more than 6 minutes behind the current start time, then the continuing block is another "x" block. The calculation of base points is relative to the sum of amount of minutes that would have determined the threshold in each block; so for 2 2-blick blocks, it would have been 6+6 minutes as the base point threshold, relative to the previous end time. Here's an example to study:

{focus: [sys]}
09:24 - [sys] calc [3] - [err] hang clothes [6] --- 09:52 (-16,+1f
x09:36 - [sys] calc [3] +
x09:48 + [err] start dishwasher [3] - [sys] org 7 [3] +
10:00 + [err] wipe counter, wash pots [6] - [err] put away 5 things [3] --- 10:09 (+4,+1f

Let's break down what happened here. We finished the first block very late; more than 12 minutes late, therefore the next block is a 1-blick "x" block. But that "x" block continues. Since it's an "x" block, we "imagine" that it ended 3 minutes after 09:52, which is 09:55. Now, 09:55 is still more than 6 minutes after 09:48 but not more than 12 minutes after 09:48, so the 09:48 block is still an "x" block but a 2-blick one. But this "x" block continues as well! We "imagine" that this one ends 6 minutes after the previous imagined end which was 09:55, so, 10:01. Now this is no longer 6 or more minutes late, so the next continuation block starts as a non-"x" block and has a standard 3 blicks. Now, the base point calculation is totally independent of "imagined" end times. For that, we simply say: The first 1-blick block normally counts as a 3-minute threshold; the second 2-blick block normally counts as a 6-minute threshold; the third standard block normally counts as a 12-minute threshold; therefore the total is 21 minutes; 09:52 plus 21 minutes is 10:13; therefore 4 base points are awarded. Make sure this makes sense and is consistent; it's possible I've made a mistake.

Now, let me finish describing what tooling would do, once developed later. It would close all the points with a running sum after an "=" sign, to pull a previous example, like this:

{focus: [wr], [err]}
13:44 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] - [sys] check points [3] --- 14:02 (-2,+2f,+1a=1)
14:00 - [err] look up flights ~--- 14:13 (+1,+1f,+2a=5)
14:12 - [sp/a] claude ~[6] - [...] f [3] --- 14:28 (-3=2)
14:24 - [sp/b] slack-up ~[3] - [err] reply to taylor [3] - [bkc] read 3 pages [3] --- 14:42 (-2,+1f,+1a=2)
x14:36 - [err] do the dishes [6] --- 14:50 (-2=0)
14:48 - [wr] brainstorm ~[3] - [bkc] read 2 pages [3] - [wr] brainstorm ~[3] -<- 15:14 (-12,+1f,+1a=-10)
x15:00 - [bkc] read 2 pages [3] --- 15:19 (-2=-12)
;;;
x15:36 - [err] call taylor ~[6] --- 15:49 (-1,+1f=-12)
15:48 - [sys] calc ~[3] ... [bkc] read 4 pages [6] <-- 15:59 (+2,+1a=-9)

Please make sure that makes sense; I may have made mistakes.

Now, the tooling doing these points calculations is separate from the language grammar. All you need to know for proper syntax is that there's a parentheses with comma-separated point notations, an equal sign, an integer. I was just describing the tooling for completeness in this document. I want to start with just Neovim syntax highlighting for this; assume I will manually do all the points calculations. The syntax/grammar does not need to check whether "x" blocks are accurately placed, nor of course whether points are accurately awarded or summed. That's all the job of a separate tool. I just want syntax highlighting and linter errors where syntax is not followed. Points not being awarded or summed is not a syntax error; just an open parenthesis is valid at the end of a line.

I forgot one other possible syntax; a new kind of line. Please allow in the grammar a line that starts with "[...]" (and any leading whitespace as usual) followed by 2 items in parentheses, e.g.

[...] (eat) (24)

The first parenthesis item is arbitrary. The second parenthesis item is the number of blocks to skip. So, if the block before that was 06:00, the block after that would be 06:36, and we'd treat the "[...]" block as if it didn't exist, doing all calculations etc. as if it weren't there and it were a smooth transition. We call these "rest blocks".

Please make a TODO list referring to this INSTRUCTIONS.md. Please begin with a first pass on understanding these specs purely to recommend me languages and frameworks for implementing what we want to implement. Then do a second pass where you produce a source-of-truth or blueprint language specification for all I have described, taking care to include every detail, in a file called SPECS.md. Feel free to organize the specification in a way that makes more sense to you than the way I've described it. In fact please do several passes (put at least 3 passes in the TODO), each time reorganizing information in a way that is easiest to understand, for both AI and humans, balanced. It is very important that grammar rules are correct, consistent, and minimally expressed, so don't hesitate to ask me as many rounds of questions as needed to be clear. Don't hesitate to do many, many iterations, re-reading these instructions and re-thinking things again and again. In fact build re-iterations into your TODO list. Once we are confident about our SPECS.md, we'll make a PLAN.md where you describe the steps taken to actually implement everything. Then we will embark on the plan together.
