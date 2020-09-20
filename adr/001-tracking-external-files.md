## Tracking External Files

### Status

Draft

### Context

How can I track files like .bashrc and program configs in a git repo?

- They're often read and modified by external programs.
- Therefore they can't change locations.

### Approaches

#### 1. Why track them at all?

If the sole purpose is backup, then a low-cost approach is to sync via Dropbox or Drive. Although, it does add another ecosystem to track. In my case, I'd like to share some files publicly and in the same place as my projects, so this doesn't work.

#### 2. Softlink repo to original

    ln -s ~/.bashrc ~/repo/some/path/.bashrc
    
This won't commit the file's contents, only the literal bytes of the softlink.

#### 3. Hardlink repo to original

    ln ~/.bashrc ~/repo/some/path/.bashrc
    
This works, mostly. Opening and editing the file from either location affects the target, as we want. Therefore changes by us or programs show up as unstaged changes in `git status`.

But there's a problem. If a remote change is made, like Github's web interface or from another computer, the `git pull` will overwrite the symlink with an actual file. As a result, external changes to ~/.bashrc stop showing up as unstaged changes, giving us no hint that something's changed. The files may then diverge, meaning we can't blindly recreate the hardlink (`ln -f`). We'd have to do a manual diff and merge first.

#### 4. Softlink original to repo

    ln -s ~/repo/some/path/.bashrc ~/.bashrc
    
This averts the `git pull` issue, since a softlink will point to the repo's file by path, even if overwritten.

But, much like the `git pull` issue, only translated to the other side, ~/.bashrc can be overwritten as well, destroying the symlink. For example, programs—maybe even some editors—commonly do an "atomic write" by writing contents to a temporary file then copying that file over. Then here too, the files may diverge.

In fact, #3 is weak to this issue as well—in other words, hardlinks break when overwritten on either side. (It was just easier to explain this here.)

#### 5. Hardlink original to repo

    ln ~/repo/some/path/.bashrc ~/.bashrc

But now we know that hardlinks are brittle, so this is the worst of both #3 and #4.
