v=randn(3,1)
u=v/norm(v)
sum=0
k=30
for i=1:k
    V=randn(3,1)
    U=V/norm(V)
    %check_unity=sqrt(U(1)^2+U(2)^2+U(3)^2)
    dot_product=abs(dot(u,U));
    sum+=dot_product;
end
sum/k
